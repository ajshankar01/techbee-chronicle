"""
Layer 3: Data Processing Layer
Extracts, cleans, and chunks enterprise documents from the raw/ folder.
"""
import os
import re
from typing import List, Dict, Any

def clean_text(text: str) -> str:
    """Normalize line endings and collapse erratic whitespace"""
    text = re.sub(r'\r\n|\r', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def chunk_document(file_path: str, chunk_size: int = 400, overlap: int = 50) -> List[Dict[str, Any]]:
    """
    Parses a text or markdown document and splits it by semantic sections and token boundaries.
    Returns a list of chunk dictionaries with metadata.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Raw document not found: {file_path}")
        
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        raw_text = f.read()

    cleaned = clean_text(raw_text)
    filename = os.path.basename(file_path)
    
    # Split by major section headers (## SECTION ...)
    sections = re.split(r'(?=^##\s+)', cleaned, flags=re.MULTILINE)
    
    chunks: List[Dict[str, Any]] = []
    chunk_index = 0
    
    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
            
        # Extract section title if present
        title_match = re.match(r'^##\s+(.+)', sec)
        section_title = title_match.group(1).strip() if title_match else "General Policy"
        
        words = sec.split()
        if len(words) <= chunk_size:
            chunks.append({
                "chunk_index": chunk_index,
                "section_title": section_title,
                "content": sec,
                "token_count": len(words),
                "filename": filename,
                "file_path": file_path
            })
            chunk_index += 1
        else:
            # Overlapping window chunking for long sections
            start = 0
            while start < len(words):
                end = min(start + chunk_size, len(words))
                chunk_words = words[start:end]
                sub_text = " ".join(chunk_words)
                
                chunks.append({
                    "chunk_index": chunk_index,
                    "section_title": f"{section_title} (Part {chunk_index + 1})",
                    "content": sub_text,
                    "token_count": len(chunk_words),
                    "filename": filename,
                    "file_path": file_path
                })
                chunk_index += 1
                if end == len(words):
                    break
                start += (chunk_size - overlap)
                
    return chunks
