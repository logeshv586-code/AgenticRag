"""
Deployment Layer — Packages RAG pipelines for production.
Supports Docker, Kubernetes, and Serverless configurations.
"""
import os
import json
import uuid
import logging

logger = logging.getLogger(__name__)

DEPLOY_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "deployments")
os.makedirs(DEPLOY_DIR, exist_ok=True)


# ═══════════════════════════════════════════════════════════
#  Docker Packager
# ═══════════════════════════════════════════════════════════

def _create_docker_package(pipeline_id: str, config: dict, target_dir: str):
    """Generate Dockerfile and docker-compose.yml for the RAG system."""
    
    # 1. Dockerfile
    dockerfile = f"""# Dockerfile for RAG Pipeline: {pipeline_id}
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    libffi-dev \\
    libssl-dev \\
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PIPELINE_ID={pipeline_id}
ENV RAG_TYPE={config.get('ragType', 'basic')}
ENV HOST=0.0.0.0
ENV PORT=8000

# Expose port
EXPOSE 8000

# Run the API
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
"""
    with open(os.path.join(target_dir, "Dockerfile"), "w") as f:
        f.write(dockerfile)

    # 2. docker-compose.yml (Include dependent services if needed)
    db_type = config.get("dbType", "local")
    local_db = config.get("localDb", "chroma")
    
    services = {
        "api": {
            "build": ".",
            "ports": ["8000:8000"],
            "volumes": ["./data:/app/data"],
            "environment": [
                f"PIPELINE_ID={pipeline_id}",
            ]
        }
    }
    
    # Add external services if local execution is requested
    if db_type == "local":
        if local_db == "redis":
            services["redis"] = {
                "image": "redis/redis-stack:latest",
                "ports": ["6379:6379", "8001:8001"],
            }
            services["api"]["environment"].append("REDIS_URL=redis://redis:6379")
            services["api"]["depends_on"] = ["redis"]
        elif local_db == "pgvector":
            services["pgvector"] = {
                "image": "ankane/pgvector:latest",
                "environment": ["POSTGRES_PASSWORD=postgres"],
                "ports": ["5432:5432"],
            }
            services["api"]["environment"].append("PGVECTOR_CONNECTION_STRING=postgresql://postgres:postgres@pgvector:5432/postgres")
            services["api"]["depends_on"] = ["pgvector"]

    import yaml
    with open(os.path.join(target_dir, "docker-compose.yml"), "w") as f:
        yaml.dump({"version": "3.8", "services": services}, f, default_flow_style=False)


# ═══════════════════════════════════════════════════════════
#  Kubernetes Packager
# ═══════════════════════════════════════════════════════════

def _create_k8s_package(pipeline_id: str, config: dict, target_dir: str):
    """Generate Kubernetes Deployment and Service YAMLs."""
    
    deployment = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {
            "name": f"rag-api-{pipeline_id.lower()}",
            "labels": {"app": "rag-api"}
        },
        "spec": {
            "replicas": 2,
            "selector": {"matchLabels": {"app": "rag-api"}},
            "template": {
                "metadata": {"labels": {"app": "rag-api"}},
                "spec": {
                    "containers": [{
                        "name": "api",
                        "image": f"my-registry/rag-api:{pipeline_id.lower()}",
                        "ports": [{"containerPort": 8000}],
                        "env": [
                            {"name": "PIPELINE_ID", "value": pipeline_id},
                            {"name": "RAG_TYPE", "value": config.get('ragType', 'basic')}
                        ],
                        "resources": {
                            "limits": {"memory": "2Gi", "cpu": "1000m"},
                            "requests": {"memory": "512Mi", "cpu": "250m"}
                        }
                    }]
                }
            }
        }
    }
    
    service = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": f"rag-api-svc-{pipeline_id.lower()}",
        },
        "spec": {
            "selector": {"app": "rag-api"},
            "ports": [{"port": 80, "targetPort": 8000}],
            "type": "LoadBalancer"
        }
    }
    
    import yaml
    with open(os.path.join(target_dir, "k8s-deployment.yml"), "w") as f:
        yaml.dump_all([deployment, service], f, default_flow_style=False)


# ═══════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════

def package_deployment(pipeline_id: str, config: dict, format: str = "docker") -> dict:
    """
    Package the pipeline configuration for deployment.
    Returns the path to the deployment package.
    """
    package_dir = os.path.join(DEPLOY_DIR, pipeline_id)
    os.makedirs(package_dir, exist_ok=True)
    
    # Save the config itself
    with open(os.path.join(package_dir, "config.json"), "w") as f:
        json.dump(config, f, indent=2)
        
    try:
        if format == "docker":
            _create_docker_package(pipeline_id, config, package_dir)
            msg = "Docker package created (Dockerfile + docker-compose.yml)"
        elif format == "kubernetes":
            _create_k8s_package(pipeline_id, config, package_dir)
            msg = "Kubernetes package created (Deployment + Service)"
        else:
            msg = f"Unknown format: {format}. Only config saved."
            
        logger.info(f"Deployment packaged: {pipeline_id} in {format} format")
        return {
            "status": "success", 
            "package_dir": package_dir,
            "message": msg
        }
    except Exception as e:
        logger.error(f"Deployment packaging failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
