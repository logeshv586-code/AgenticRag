from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os

from services.scraper import scrape_urls
from services.document_parser import parse_document
from services.rag_builder import deploy_rag_system

app = FastAPI(title="Agentic RAG Creator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScrapeRequest(BaseModel):
    urls: List[str]

class ChatRequest(BaseModel):
    query: str

class DeployRequest(BaseModel):
    extracted_texts: List[str]
    ragType: str
    useCase: str
    vectorDb: str
    theme: str

@app.post("/api/scrape")
async def api_scrape(req: ScrapeRequest):
    try:
        texts = scrape_urls(req.urls)
        return {"status": "success", "texts": texts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    try:
        # Save temp file
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        text = parse_document(temp_path)
        os.remove(temp_path)
        
        return {"status": "success", "text": text}
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    # This is a mock interaction representing local LLM responses
    # helping the user decide RAG topology based on the query.
    q = req.query.lower()
    answer = "I am your RAG creation assistant. Based on what you need, I can recommend an architecture."
    
    if "faqs" in q or "basic" in q:
        answer = "For an FAQ bot, a Basic RAG with Pinecone should be perfect."
    elif "complex" in q or "multi" in q or "agentic" in q:
        answer = "I recommend an Agentic RAG architecture. Tools will help break down complex queries."
    elif "docs" in q or "pdf" in q:
        answer = "Hybrid RAG with ChromaDB or Pinecone works well for retrieving text from documents."
    elif "hi" in q or "hello" in q:
        answer = "Hello! Tell me about the kinds of data you have and what you want your chatbot to achieve."
        
    return {"answer": answer}

@app.post("/api/deploy")
async def api_deploy(req: DeployRequest):
    try:
        deployment_info = deploy_rag_system(
            texts=req.extracted_texts,
            rag_type=req.ragType,
            use_case=req.useCase,
            vector_db=req.vectorDb
        )
        return {
            "status": "success",
            "message": "Agentic RAG deployed successfully.",
            "deployment_info": deployment_info,
            "theme": req.theme
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}
