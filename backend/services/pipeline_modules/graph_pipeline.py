"""
Graph Pipeline — Knowledge-graph-aware RAG with entity extraction and graph traversal.
Pipeline: Query → Entity Extraction → Graph Store → Graph Traversal → LLM

Supports:
  - Local: NetworkX in-memory graph (zero-dependency)
  - API:   Neo4j cloud instance
"""
import logging
from typing import List, Dict, Optional, Set, Tuple

from haystack import Pipeline
from haystack.components.builders import PromptBuilder

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  Entity Extractor
# ═══════════════════════════════════════════════════════════

class EntityExtractor:
    """
    Extracts named entities from text.
    Uses spaCy when available, falls back to regex-based extraction.
    """

    def __init__(self, entity_types: List[str] = None, model: str = "en_core_web_sm"):
        self.entity_types = entity_types or ["PERSON", "ORG", "GPE", "CONCEPT"]
        self.model = model
        self._nlp = None

    def _load_nlp(self):
        """Lazy-load spaCy model."""
        if self._nlp is None:
            try:
                import spacy
                self._nlp = spacy.load(self.model)
            except (ImportError, OSError):
                logger.warning(f"spaCy model '{self.model}' not available — using regex fallback")
                self._nlp = "fallback"

    def extract(self, text: str) -> List[dict]:
        """Extract entities from text. Returns list of {text, label, start, end}."""
        self._load_nlp()

        if self._nlp == "fallback":
            return self._extract_regex(text)

        doc = self._nlp(text)
        entities = []
        for ent in doc.ents:
            if ent.label_ in self.entity_types or not self.entity_types:
                entities.append({
                    "text": ent.text,
                    "label": ent.label_,
                    "start": ent.start_char,
                    "end": ent.end_char,
                })
        return entities

    def _extract_regex(self, text: str) -> List[dict]:
        """Simple regex-based entity extraction (fallback)."""
        import re
        entities = []
        # Capitalized multi-word phrases as potential entities
        for match in re.finditer(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', text):
            entities.append({
                "text": match.group(),
                "label": "ENTITY",
                "start": match.start(),
                "end": match.end(),
            })
        return entities


# ═══════════════════════════════════════════════════════════
#  Graph Store (Local + API dual support)
# ═══════════════════════════════════════════════════════════

class LocalGraphStore:
    """In-memory graph store using NetworkX (zero external dependencies)."""

    def __init__(self):
        try:
            import networkx as nx
            self.graph = nx.DiGraph()
            self._nx = nx
            self._available = True
        except ImportError:
            logger.warning("networkx not installed — graph store will use dict-based fallback")
            self._available = False
            self._nodes: Dict[str, dict] = {}
            self._edges: List[Tuple[str, str, dict]] = []

    def add_entity(self, entity_id: str, label: str, properties: dict = None):
        """Add a node to the graph."""
        if self._available:
            self.graph.add_node(entity_id, label=label, **(properties or {}))
        else:
            self._nodes[entity_id] = {"label": label, **(properties or {})}

    def add_relationship(self, source: str, target: str, relation: str, properties: dict = None):
        """Add an edge to the graph."""
        if self._available:
            self.graph.add_edge(source, target, relation=relation, **(properties or {}))
        else:
            self._edges.append((source, target, {"relation": relation, **(properties or {})}))

    def traverse(self, start_entity: str, max_depth: int = 2) -> List[dict]:
        """Traverse the graph from a start entity up to max_depth hops."""
        results = []
        if self._available:
            visited = set()
            self._bfs_traverse(start_entity, max_depth, visited, results)
        else:
            results = self._fallback_traverse(start_entity, max_depth)
        return results

    def _bfs_traverse(self, start: str, max_depth: int, visited: Set[str], results: List[dict]):
        """BFS traversal using NetworkX."""
        if max_depth <= 0 or start in visited:
            return
        visited.add(start)

        if not self.graph.has_node(start):
            return

        node_data = self.graph.nodes[start]
        results.append({
            "entity": start,
            "label": node_data.get("label", "Unknown"),
            "depth": 0,
        })

        for neighbor in self.graph.neighbors(start):
            if neighbor not in visited:
                edge_data = self.graph.edges[start, neighbor]
                results.append({
                    "entity": neighbor,
                    "label": self.graph.nodes[neighbor].get("label", "Unknown"),
                    "relation": edge_data.get("relation", "related_to"),
                    "from": start,
                    "depth": 1,
                })
                if max_depth > 1:
                    self._bfs_traverse(neighbor, max_depth - 1, visited, results)

    def _fallback_traverse(self, start: str, max_depth: int) -> List[dict]:
        """Simple traversal for dict-based fallback."""
        results = []
        if start in self._nodes:
            results.append({"entity": start, "label": self._nodes[start]["label"], "depth": 0})
        for src, tgt, data in self._edges:
            if src == start:
                results.append({
                    "entity": tgt,
                    "label": self._nodes.get(tgt, {}).get("label", "Unknown"),
                    "relation": data.get("relation", "related_to"),
                    "from": src,
                    "depth": 1,
                })
        return results

    def build_from_documents(self, documents: List, extractor: EntityExtractor):
        """Build graph from document content by extracting entities and relationships."""
        all_entities = {}

        for doc in documents:
            content = doc.content if hasattr(doc, 'content') else str(doc)
            entities = extractor.extract(content)

            for ent in entities:
                ent_id = ent["text"].lower().replace(" ", "_")
                self.add_entity(ent_id, ent["label"], {"source_text": ent["text"]})
                all_entities[ent_id] = ent

            # Create co-occurrence relationships
            ent_ids = [e["text"].lower().replace(" ", "_") for e in entities]
            for i, eid1 in enumerate(ent_ids):
                for eid2 in ent_ids[i + 1:]:
                    if eid1 != eid2:
                        self.add_relationship(eid1, eid2, "co_occurs_with")

        logger.info(f"Graph built: {len(all_entities)} entities")
        return all_entities


class Neo4jGraphStore:
    """Neo4j cloud-based graph store."""

    def __init__(self, uri: str = "bolt://localhost:7687",
                 user: str = "neo4j", password: str = ""):
        self.uri = uri
        self.user = user
        self.password = password
        self._driver = None

    def _connect(self):
        if self._driver is None:
            try:
                from neo4j import GraphDatabase
                self._driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
                logger.info(f"Connected to Neo4j at {self.uri}")
            except ImportError:
                raise ImportError("neo4j driver not installed. Install with: pip install neo4j")
            except Exception as e:
                raise ConnectionError(f"Cannot connect to Neo4j: {e}")

    def add_entity(self, entity_id: str, label: str, properties: dict = None):
        self._connect()
        props = properties or {}
        with self._driver.session() as session:
            session.run(
                f"MERGE (n:{label} {{id: $id}}) SET n += $props",
                id=entity_id, props=props,
            )

    def add_relationship(self, source: str, target: str, relation: str, properties: dict = None):
        self._connect()
        props = properties or {}
        with self._driver.session() as session:
            session.run(
                f"MATCH (a {{id: $src}}), (b {{id: $tgt}}) "
                f"MERGE (a)-[r:{relation}]->(b) SET r += $props",
                src=source, tgt=target, props=props,
            )

    def traverse(self, start_entity: str, max_depth: int = 2) -> List[dict]:
        self._connect()
        results = []
        with self._driver.session() as session:
            query = (
                f"MATCH path = (start {{id: $start_id}})-[*1..{max_depth}]-(end) "
                f"RETURN start, relationships(path) as rels, nodes(path) as nodes "
                f"LIMIT 50"
            )
            records = session.run(query, start_id=start_entity)
            for record in records:
                for node in record["nodes"]:
                    results.append({
                        "entity": dict(node).get("id", str(node.id)),
                        "label": list(node.labels)[0] if node.labels else "Unknown",
                    })
        return results

    def build_from_documents(self, documents: List, extractor: EntityExtractor):
        """Build graph in Neo4j from document content."""
        all_entities = {}
        for doc in documents:
            content = doc.content if hasattr(doc, 'content') else str(doc)
            entities = extractor.extract(content)
            for ent in entities:
                ent_id = ent["text"].lower().replace(" ", "_")
                self.add_entity(ent_id, ent["label"], {"source_text": ent["text"]})
                all_entities[ent_id] = ent
            ent_ids = [e["text"].lower().replace(" ", "_") for e in entities]
            for i, eid1 in enumerate(ent_ids):
                for eid2 in ent_ids[i + 1:]:
                    if eid1 != eid2:
                        self.add_relationship(eid1, eid2, "CO_OCCURS")
        logger.info(f"Neo4j graph built: {len(all_entities)} entities")
        return all_entities


# ═══════════════════════════════════════════════════════════
#  Graph Pipeline Builder
# ═══════════════════════════════════════════════════════════

def build_graph_pipeline(document_store, config: dict, retriever, generator) -> dict:
    """
    Build a graph RAG pipeline with entity extraction and graph traversal.

    Pipeline flow:
        Query → Entity Extraction → Graph Traversal →
        Retriever (context enriched) → LLM → Response
    """
    dynamic_cfg = config.get("dynamicConfig", {})
    entity_types = dynamic_cfg.get("entityTypes", ["PERSON", "ORG", "GPE"])
    traversal_depth = dynamic_cfg.get("relationshipDepth", 2)
    graph_mode = dynamic_cfg.get("graphMode", "local")  # "local" or "api"
    api_keys = config.get("apiKeys", {})

    # Initialize entity extractor
    extractor = EntityExtractor(entity_types=entity_types)

    # Initialize graph store (local vs API)
    if graph_mode == "api":
        neo4j_uri = dynamic_cfg.get("neo4jUri", "bolt://localhost:7687")
        neo4j_user = dynamic_cfg.get("neo4jUser", "neo4j")
        neo4j_pass = api_keys.get("neo4j", "")
        try:
            graph_store = Neo4jGraphStore(uri=neo4j_uri, user=neo4j_user, password=neo4j_pass)
            logger.info("Graph RAG: Using Neo4j graph store")
        except Exception as e:
            logger.warning(f"Neo4j unavailable ({e}), falling back to local NetworkX")
            graph_store = LocalGraphStore()
    else:
        graph_store = LocalGraphStore()
        logger.info("Graph RAG: Using local NetworkX graph store")

    # Build the inner retrieval pipeline
    pipeline = Pipeline()
    pipeline.add_component("retriever", retriever)

    template = """You are a knowledge graph-aware AI assistant.
    Analyze relationships between entities to provide deep, connected answers.

    Entity and relationship context from the knowledge graph:
    {{ graph_context }}

    Document context:
    {% for document in documents %}
        {{ document.content }}
    {% endfor %}

    Identify key entities and their relationships to answer:
    Question: {{ query }}
    Answer (with entity relationships):"""

    prompt_builder = PromptBuilder(template=template)
    pipeline.add_component("prompt_builder", prompt_builder)
    pipeline.add_component("llm", generator)

    pipeline.connect("retriever.documents", "prompt_builder.documents")
    pipeline.connect("prompt_builder", "llm")

    return {
        "pipeline": pipeline,
        "extractor": extractor,
        "graph_store": graph_store,
        "traversal_depth": traversal_depth,
        "meta": {
            "entity_types": entity_types,
            "traversal_depth": traversal_depth,
            "graph_mode": graph_mode,
        },
    }


def execute_graph_query(pipeline_info: dict, query: str) -> str:
    """Execute a query through the graph pipeline with entity extraction and traversal."""
    extractor = pipeline_info["extractor"]
    graph_store = pipeline_info["graph_store"]
    depth = pipeline_info["traversal_depth"]
    pipeline = pipeline_info["pipeline"]

    # Step 1: Extract entities from query
    query_entities = extractor.extract(query)
    logger.info(f"Graph: Extracted {len(query_entities)} entities from query")

    # Step 2: Traverse graph for each entity
    graph_results = []
    for ent in query_entities:
        ent_id = ent["text"].lower().replace(" ", "_")
        traversal = graph_store.traverse(ent_id, max_depth=depth)
        graph_results.extend(traversal)

    # Step 3: Format graph context
    if graph_results:
        graph_lines = []
        for r in graph_results:
            if "relation" in r:
                graph_lines.append(f"  {r.get('from', '?')} --[{r['relation']}]--> {r['entity']} ({r['label']})")
            else:
                graph_lines.append(f"  Entity: {r['entity']} ({r['label']})")
        graph_context = "Knowledge graph relationships:\n" + "\n".join(graph_lines)
    else:
        graph_context = "No graph relationships found for the query entities."

    # Step 4: Run RAG pipeline with graph context
    try:
        result = pipeline.run({
            "retriever": {"query": query},
            "prompt_builder": {
                "query": query,
                "graph_context": graph_context,
            },
        })
        answer = result.get("llm", {}).get("replies", ["No response generated."])[0]
    except Exception as e:
        logger.error(f"Graph pipeline error: {e}")
        answer = f"Error: {str(e)}"

    return answer


def get_graph_pipeline_nodes() -> dict:
    """Return visualization nodes specific to graph pipeline."""
    return {
        "extra_nodes": [
            {"id": "entity_extractor", "label": "Entity Extractor", "type": "processor"},
            {"id": "graph_store", "label": "Graph Store", "type": "database"},
            {"id": "graph_traverser", "label": "Graph Traverser", "type": "retriever"},
        ],
        "extra_edges": [
            {"source": "ingestion", "target": "entity_extractor"},
            {"source": "entity_extractor", "target": "graph_store"},
            {"source": "graph_store", "target": "graph_traverser"},
            {"source": "graph_traverser", "target": "embedder"},
        ],
        "remove_edges": [
            {"source": "ingestion", "target": "embedder"},
        ],
    }
