from tortoise.models import Model
from tortoise import fields


class Source(Model):
    id = fields.IntField(pk=True)
    name = fields.TextField()
    creation_timestamp = fields.DatetimeField()
    root_url = fields.TextField()
    scrape_url = fields.TextField()


class Article(Model):
    id = fields.IntField(pk=True)
    source = fields.ForeignKeyField("models.Source", related_name="articles")
    title = fields.TextField()
    title_hash = fields.CharField(max_length=32, unique=True)
    description = fields.TextField(null=True)
    link = fields.TextField()
    pub_date = fields.DatetimeField()
    content = fields.TextField()
    fact_checked = fields.BooleanField(default=False)
    fact_summary = fields.TextField(null=True)
