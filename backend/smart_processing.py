from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
import json


load_dotenv()


class ContentAnalyzer:
    def __init__(self, model_id: str, context_path: str):
        self.model_id = model_id
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY2"))

        try:
            with open(context_path, "r", encoding="utf-8") as f:
                self.contexts = json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"Context file not found.")
        except json.JSONDecodeError:
            raise ValueError(f"Context file contains invalid JSON.")

        self.config = types.GenerateContentConfig(
            system_instruction=self.contexts["fact_checker"],
            tools=[
                types.Tool(
                    google_search=types.GoogleSearchRetrieval(
                        dynamic_retrieval_config=types.DynamicRetrievalConfig(
                            mode=types.DynamicRetrievalConfigMode.MODE_DYNAMIC,
                            dynamic_threshold=0.3,
                        )
                    )
                )
            ],
        )

    def fact_check_written_content(self, content: str) -> str:
        response = self.client.models.generate_content(
            model=self.model_id,
            config=self.config,
            contents=[content],
        )
        return response.text

    def summarize_content(self, contents: list[str]) -> str:
        if not contents:
            raise ValueError("Contents cannot be empty.")

        combined_text = "\n".join(f"- {content}" for content in contents)

        summary_config = types.GenerateContentConfig(
            system_instruction=self.contexts["summarizer"],
        )

        response = self.client.models.generate_content(
            model=self.model_id,
            config=summary_config,
            contents=[combined_text],
        )
        return response.text
