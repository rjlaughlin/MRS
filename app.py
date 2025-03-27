from flask import Flask, request, jsonify, render_template
from pyspark.ml.recommendation import ALSModel
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, expr, concat, lit
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler

app = Flask(__name__)

# Save df_selected to CSV
csv_file_path = "resources/movies_data.csv"

# Load the CSV into a Pandas DataFrame
# Load movie data
movies_df = pd.read_csv(csv_file_path)
movies_df = movies_df.dropna(subset=['genres', 'overview', 'year'])

# Preprocess genre (replace '|' with spaces)
movies_df['genres'] = movies_df['genres'].apply(lambda x: ' '.join(x.replace('|', ' ').split()))

# Convert text features using TF-IDF
tfidf_vectorizer = TfidfVectorizer(stop_words='english')

# Apply TF-IDF to overview and title separately
overview_matrix = tfidf_vectorizer.fit_transform(movies_df['overview'])
title_matrix = tfidf_vectorizer.fit_transform(movies_df['name'])

# One-hot encode genres
genre_vectorizer = TfidfVectorizer()
genre_matrix = genre_vectorizer.fit_transform(movies_df['genres'])

# Normalize popularity (scale to 0-1)
popularity_scores = movies_df[['popularity']].fillna(0)  # Handle missing values
scaler = MinMaxScaler()
popularity_matrix = scaler.fit_transform(popularity_scores)

# Compute cosine similarities
sim_overview = cosine_similarity(overview_matrix)
sim_genre = cosine_similarity(genre_matrix)
sim_title = cosine_similarity(title_matrix)
sim_popularity = cosine_similarity(popularity_matrix)

# Define weights for each feature
weights = {
    "overview": 0.001,  # Most important
    "genre": 0.988,
    "popularity": 0.01,
    "title": 0.001  # Least important to avoid sequels being over-recommended
}

# Compute final weighted similarity matrix
final_similarity = (
    weights["overview"] * sim_overview +
    weights["genre"] * sim_genre +
    weights["popularity"] * sim_popularity +
    weights["title"] * sim_title
)

# Convert to DataFrame for easier indexing
cosine_sim_df = pd.DataFrame(final_similarity, index=movies_df['movieId'], columns=movies_df['movieId'])

# Precompute Clusters
num_clusters = 10  # Adjust for better variety
combined_features = (sim_overview + sim_genre + sim_title) / 3  # Averaging similarities
kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
movies_df['cluster'] = kmeans.fit_predict(combined_features)

# Recommendation function
def recommend_movies_multiple(movie_ids, top_n=5):
    valid_movie_ids = [movie_id for movie_id in movie_ids if movie_id in cosine_sim_df.index]

    if not valid_movie_ids:
        return []

    # Get similarity scores (using max instead of mean)
    sim_scores = cosine_sim_df.loc[valid_movie_ids].max(axis=0)

    # Exclude selected movies
    sim_scores = sim_scores.drop(valid_movie_ids, errors="ignore")

    # Get top 20 similar movies to allow for variety
    top_movie_ids = sim_scores.sort_values(ascending=False).head(20).index

    # Retrieve movie details and clustering info
    similar_movies_df = movies_df[movies_df['movieId'].isin(top_movie_ids)][['movieId', 'name', 'year', 'backdrop_url', 'cluster', 'genres']].copy()

    selected_movies = []
    used_clusters = set()
    used_franchises = set()
    used_genres = set()

    # Add a franchise column for filtering
    similar_movies_df["franchise"] = similar_movies_df["name"].apply(get_franchise)

    # Step 1: Strictly enforce 1 movie per franchise
    for _, row in similar_movies_df.iterrows():
        franchise = row["franchise"]
        genre_list = row["genres"].split()

        if franchise not in used_franchises:
            selected_movies.append(row)
            used_franchises.add(franchise)
            used_clusters.add(row["cluster"])
            used_genres.update(genre_list)

        if len(selected_movies) == top_n:
            break

    # Step 2: Fill remaining spots with cluster & genre diversity
    if len(selected_movies) < top_n:
        remaining_movies = similar_movies_df[~similar_movies_df["movieId"].isin([m["movieId"] for m in selected_movies])]

        for _, row in remaining_movies.iterrows():
            selected_movies.append(row)
            if len(selected_movies) == top_n:
                break

    # Convert to dictionary format
    return pd.DataFrame(selected_movies).to_dict(orient="records")

def get_franchise(title):
    """Extracts franchise keyword dynamically based on the first 2-3 words."""
    return " ".join(title.lower().split()[:2])

@app.route("/")
def home():
    return render_template("index.html")  # Make sure your file is named index.html

@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.get_json()
    selected_movies = data.get("movies", [])

    if len(selected_movies) != 5:
        return jsonify({"error": "Please select exactly 5 movies"}), 400

    recommendations = recommend_movies_multiple(selected_movies, top_n=5)

    if not recommendations:
        return jsonify({"error": "No recommendations found for selected movies"}), 404

    return jsonify({"recommendations": recommendations})

@app.route('/movies', methods=["GET"])
def get_movies():
    global movies_df  

    if movies_df is None or movies_df.empty:
        return jsonify({"error": "No movies found"}), 404

    try:
        # Ensure NaN values are converted properly
        movies_cleaned = movies_df.fillna(value="Unknown")  # Replace NaN with "Unknown"

        # Debugging: Print first 10 records before sending response
        print("Returning movies data:", movies_cleaned.head(10).to_dict(orient="records"))

        return jsonify(movies_cleaned.to_dict(orient="records"))
    except Exception as e:
        print(f"Error processing movies data: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

if __name__ == "__main__":
    app.run(debug=True)