from fastapi import FastAPI, HTTPException, Response, status, Query
from fastapi.middleware.cors import CORSMiddleware
from models import Source, Article
from pydantic import BaseModel, HttpUrl
from scraper import NewsScraper
from smart_processing import ContentAnalyzer
from tortoise.contrib.fastapi import register_tortoise
from tortoise.contrib.pydantic import pydantic_model_creator
from datetime import datetime, timedelta, date
from typing import Optional
from tortoise.expressions import Q
import uvicorn
from dotenv import load_dotenv
import os


load_dotenv()

APP_TITLE = "FactNews"

MODEL_USED = "gemini-2.0-flash-lite"

POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_DB = os.getenv("POSTGRES_DB")
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_PORT = os.getenv("POSTGRES_PORT")

DATABASE_URL = f"postgres://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"


app = FastAPI(title=APP_TITLE)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
scraper = NewsScraper()
content_analyzer = ContentAnalyzer(MODEL_USED, os.getenv("CONTEXT_FILE_PATH"))


class SourceLink(BaseModel):
    url: HttpUrl


class SourceIdRequest(BaseModel):
    id: int


class ArticleIdRequest(BaseModel):
    id: int


Source_Pydantic = pydantic_model_creator(Source)


@app.post("/add_source/")
async def create_source(link: SourceLink):
    try:
        scrape_url = scraper.get_root_rss(str(link.url))
        root_url = scraper.get_root_url(str(link.url))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Link format is not supported")

    existing = await Source.get_or_none(root_url=root_url)
    if existing:
        raise HTTPException(status_code=400, detail="Source has already been added")

    try:
        source_info = scraper.get_source_info(scrape_url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to create source: {str(e)}")

    await Source.create(
        name=source_info["name"],
        creation_timestamp=datetime.now(),
        root_url=root_url,
        scrape_url=source_info["self_link"],
    )

    return Response(status_code=status.HTTP_201_CREATED)


@app.get("/sources")
async def get_sources():
    return await Source_Pydantic.from_queryset(Source.all())


@app.post("/remove_source")
async def remove_source(request: SourceIdRequest):
    source = await Source.get_or_none(id=request.id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    await source.delete()
    return {"detail": "Source deleted successfully"}


@app.post("/update_articles_from_source/")
async def update_articles_from_source(link: SourceLink):
    try:
        root_url = scraper.get_root_url(str(link.url))
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid URL format")

    source = await Source.get_or_none(root_url=root_url)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found in database. Please add it first.")

    # Get existing hashes to prevent duplication
    filter_hashes = await Article.filter(source=source).values_list("title_hash", flat=True)

    # Scrape new articles
    new_articles = scraper.get_articles_from_rss(
        rss_url=source.scrape_url,
        time_period_in_h=48,
        filter_hashes=filter_hashes,
    )

    # Store new articles
    for article in new_articles:
        await Article.create(
            source=source,
            title=article["title"],
            title_hash=article["title_hash"],
            description=article["description"],
            link=article["link"],
            pub_date=article["pub_date"],
            content=article["content"],
        )

    return {"detail": f"Updated {len(new_articles)} articles"}


@app.get("/articles")
async def get_articles(
    time_period: Optional[str] = Query("all", regex="^(all|today|week|month)$", description="Filter by time period"),
    selected_date: Optional[str] = Query(None, description="Specific date in YYYY-MM-DD format, overrides time_period"),
    source_id: Optional[int] = Query(None, description="Filter by source ID"),
    search: Optional[str] = Query(None, description="Filter by article title (partial match)"),
):
    filters = Q()

    # Handle selected_date filter (overrides time_period)
    if selected_date:
        try:
            sel_date = datetime.strptime(selected_date, "%Y-%m-%d").date()
            start_dt = datetime.combine(sel_date, datetime.min.time())
            end_dt = datetime.combine(sel_date, datetime.max.time())
            filters &= Q(pub_date__gte=start_dt) & Q(pub_date__lte=end_dt)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid selected_date format, expected YYYY-MM-DD")
    else:
        # No selected_date, use time_period
        today = datetime.now().date()
        if time_period == "today":
            start_dt = datetime.combine(today, datetime.min.time())
            end_dt = datetime.combine(today, datetime.max.time())
            filters &= Q(pub_date__gte=start_dt) & Q(pub_date__lte=end_dt)
        elif time_period == "week":
            start_dt = datetime.combine(today - timedelta(days=6), datetime.min.time())
            end_dt = datetime.combine(today, datetime.max.time())
            filters &= Q(pub_date__gte=start_dt) & Q(pub_date__lte=end_dt)
        elif time_period == "month":
            start_dt = datetime.combine(today - timedelta(days=29), datetime.min.time())
            end_dt = datetime.combine(today, datetime.max.time())
            filters &= Q(pub_date__gte=start_dt) & Q(pub_date__lte=end_dt)
        # if 'all', no filter added

    # Filter by source_id if provided
    if source_id:
        filters &= Q(source_id=source_id)

    # Filter by search in title if provided
    if search:
        filters &= Q(title__icontains=search)  # case-insensitive partial match

    # Build query
    articles_query = Article.filter(filters).order_by("-pub_date")

    # Generate response
    Article_Pydantic = pydantic_model_creator(Article, name="Article")
    articles_out = await Article_Pydantic.from_queryset(articles_query)

    return {"detail": articles_out}


@app.post("/fact_check_article")
async def fact_check_article(request: ArticleIdRequest):
    article = await Article.get_or_none(id=request.id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    try:
        fact_checked_text = content_analyzer.fact_check_written_content(article.content)

        article.fact_summary = fact_checked_text
        article.fact_checked = True
        await article.save()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fact check failed: {str(e)}")

    return {"detail": "Fact checking has been successfully completed"}


register_tortoise(
    app,
    db_url=DATABASE_URL,
    modules={"models": ["models"]},
    generate_schemas=True,
    add_exception_handlers=True,
)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
