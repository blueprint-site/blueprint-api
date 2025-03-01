import meilisearch
import discord
import os

# Charger la configuration de Meilisearch depuis les variables d'environnement
client = meilisearch.Client(os.getenv("MEILISEARCH_URL"), os.getenv("SEARCH_TOKEN"))
index = client.index("schematics")

async def schematicsearch(interaction: discord.Interaction, query: str, limit: int = 1):
    # Effectuer la recherche dans Meilisearch
    request = index.search(query, {"limit": limit})
    data = request.get("hits", [])
    
    # Envoyer la réponse sous forme d'embed
    await send_embeds(interaction, data)

async def send_embeds(interaction: discord.Interaction, data):
    for mod_data in data:
        embed = await gen_embed(mod_data)
        await interaction.followup.send(embed=embed)  # Utiliser followup.send() après defer()

def format_loaders(loaders):
    if not loaders:
        return "No loaders available"
    return " ".join([f"{loader}" for loader in loaders])

async def gen_embed(data):
    loaders_field = format_loaders(data.get("modloaders", []))
    embed = discord.Embed(title=data["title"], description=data["description"], color=0x689AEE)
    embed.set_author(name=data["$id"])
    embed.set_thumbnail(url=data.get("image_urls", [None])[0])
    embed.add_field(name="Loaders", value=loaders_field, inline=False)
    embed.add_field(name="Infos", value=f"https://nottelling.youthe.schematic/schematics/{data['slug']}", inline=False)
    embed.set_footer(text=f"Downloads: {data['downloads']}")
    return embed
