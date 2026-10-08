import os
from typing import Dict

import pandas as pd
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


class LocalBmsRagMapper:
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
        self._schema_cache: Dict[str, dict] = {}
        print("Initializing local RAG engine and vectorizing LBNL manual...")
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self._build_knowledge_base()

    def _build_knowledge_base(self):
        if not os.path.isfile(self.pdf_path):
            raise FileNotFoundError(f"RAG manual not found: {self.pdf_path}")

        documents = PyPDFLoader(self.pdf_path).load()
        splits = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
        ).split_documents(documents)
        if not splits:
            raise ValueError(f"RAG manual contains no readable text: {self.pdf_path}")

        self.vectorstore = Chroma.from_documents(
            documents=splits,
            embedding=self.embeddings,
        )
        print("Local RAG knowledge base built successfully")

    def get_dynamic_schema(self, csv_path: str) -> dict:
        if csv_path in self._schema_cache:
            return self._schema_cache[csv_path]
        if not os.path.isfile(csv_path):
            raise FileNotFoundError(f"Sensor data file not found: {csv_path}")

        dataframe = pd.read_csv(csv_path, nrows=0)
        headers = list(dataframe.columns)
        if len(headers) < 2:
            raise ValueError(f"Sensor data requires at least two columns: {headers}")

        self.vectorstore.as_retriever(search_kwargs={"k": 2}).invoke(
            "What are the variable names for damper position and fan speed?"
        )
        schema = {
            "damper_position": self._match_column(headers, ("damper", "position", "valve")),
            "fan_speed": self._match_column(headers, ("fan", "rpm", "speed")),
        }
        if schema["damper_position"] is None or schema["fan_speed"] is None:
            raise ValueError(f"Unable to map required sensor columns: {headers}")

        self._schema_cache[csv_path] = schema
        return schema

    @staticmethod
    def _match_column(headers, keywords):
        candidates = []
        for header in headers:
            normalized = header.lower().replace("_", " ")
            score = sum(keyword in normalized for keyword in keywords)
            if score:
                candidates.append((score, header))
        return max(candidates, key=lambda item: item[0])[1] if candidates else None


BmsRagMapper = LocalBmsRagMapper
