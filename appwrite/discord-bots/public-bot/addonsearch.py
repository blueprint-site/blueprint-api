import discord
import meilisearch
import dotenv
import os

dotenv.load_dotenv()
client = meilisearch.Client(os.getenv("MEILISEARCH_ENDPOINT"), os.getenv("MEILISEARCH_SEARCH_API_KEY"))
loaders = ["Forge", "NeoForge", "Fabric", "Quilt"]
index = client.index("addons")

async def addonsearch(interaction: discord.Interaction, query: str, limit: int = 1):
    request = index.search(query, {"limit": limit})
    data = request.get("hits", [])  # Récupérer en toute sécurité 'hits' ou une liste vide
    await send_embeds(interaction, data)
    return data

async def send_embeds(interaction: discord.Interaction, data: list[dict]):
    for mod_data in data:  # `data` est une liste de dictionnaires d'addons
        embed = await gen_embed(mod_data)
        await interaction.followup.send(embed=embed)

def format_loaders(loaders: list[str]) -> str:
    if not loaders:
        return "No loaders available"
    return " ".join([f"{loader}" for loader in loaders])

async def gen_embed(data: dict) -> discord.Embed:
    loaders_field = format_loaders(data.get("loaders", []))
    embed = discord.Embed(title=data["name"], description=data["description"], color=0x689AEE)
    embed.set_author(name=data["author"])
    embed.set_thumbnail(url=data["icon"])
    embed.add_field(name="Loaders", value=loaders_field, inline=False)
    embed.add_field(name="Download", value=f"https://nottelling.youthe.domain/addons/{data['slug']}", inline=False)
    embed.set_footer(text=f"Downloads: {data['downloads']}")
    return embed
