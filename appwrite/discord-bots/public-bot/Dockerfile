# Stage 1: Build the application
FROM python:3.9-slim as builder

WORKDIR /app

# Copier le fichier de dépendances
COPY requirements.txt /app/

# Installer les dépendances
RUN pip install --no-cache-dir -r requirements.txt

# Copier le reste du code dans l'image
COPY . /app/

# Stage 2: Créer l'image finale
FROM python:3.9-slim

WORKDIR /app

# Copier les fichiers de la première étape
COPY --from=builder /app /app

ENV PUBLIC_DISCORD_TOKEN=${PUBLIC_DISCORD_TOKEN}
ENV SEARCH_TOKEN=${SEARCH_TOKEN}
ENV MEILISEARCH_URL=${MEILISEARCH_URL}
# Utiliser python-dotenv pour charger le .env à l'exécution
RUN pip install --no-cache-dir -r requirements.txt

# Exposer le port (facultatif)
EXPOSE 8080

# Lancer le bot via python
CMD ["python", "bot.py"]
