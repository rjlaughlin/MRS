let selectedMovies = new Set();
let moviesList = [];

// document.getElementById("movieContainer").innerHTML += 
//     '<img src="https://image.tmdb.org/t/p/original/7lmBufEG7P7Y1HClYK3gCxYrkgS.jpg" width="150px">';

function loadMovies() {
    fetch("http://127.0.0.1:5000/movies")
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            moviesList = data.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)); // Ensure popularity exists
            console.log("✅ Movies loaded and sorted by popularity:", moviesList);
        })
        .catch(error => console.error("❌ Error loading movies:", error));
}

// Filter movies based on search input and display up to 10 suggestions
function filterMovies() {
    let searchQuery = document.getElementById("searchBox").value.toLowerCase().trim();
    let suggestionsContainer = document.getElementById("suggestions");
    suggestionsContainer.innerHTML = ""; // Clear previous suggestions

    if (searchQuery.length === 0) return; // Hide suggestions if search box is empty

    let filteredMovies = moviesList
        .filter(movie => movie.name?.toLowerCase().includes(searchQuery))
        .slice(0, 10); // Limit to top 10 matches

    if (filteredMovies.length === 0) {
        console.log("No matches found.");
        return;
    }

    // Populate the dropdown with results
    filteredMovies.forEach(movie => {
        let item = document.createElement("div");
        item.className = "suggestion-item";
        item.textContent = `${movie.name} (${movie.year})`;

        // Check if the movie is already selected and update UI accordingly
        if (selectedMovies.has(movie.movieId)) {
            item.style.backgroundColor = "darkgray";
        }

        // Attach selection function
        item.onclick = () => toggleSelection(movie, item);  

        suggestionsContainer.appendChild(item);
    });
}

// Attach the function to input event
document.getElementById("searchBox").addEventListener("input", filterMovies);

// Toggle movie selection (Limit: 5 movies)
function toggleSelection(movie, element) {
    if (selectedMovies.has(movie.movieId)) {
        // Deselect the movie
        selectedMovies.delete(movie.movieId);
        element.style.backgroundColor = ""; // Reset color
        removeMovieFromSelection(movie.movieId);
    } else {
        if (selectedMovies.size >= 5) {
            console.warn("You can only select up to 5 movies.");
            return; // Prevent adding more than 5 movies
        }
        // Select the movie
        selectedMovies.add(movie.movieId);
        element.style.backgroundColor = "darkgray"; // Highlight selection
        addMovieToSelection(movie.movieId);
    }

    console.log("Selected Movies:", Array.from(selectedMovies)); // Debugging
}

// Function to add selected movie text to the movieContainer
function addMovieToSelection(movieId) {
    let selectedContainer = document.getElementById("movieContainer");

    // Find the movie in moviesList by ID
    let movie = moviesList.find(m => String(m.movieId) === String(movieId));

    if (!movie) {
        console.error(`Movie with ID ${movieId} not found.`);
        return;
    }

    console.log(`Adding movie: ${movie.name} (${movie.year})`);

    // Check if the movie already exists in the selected container
    let existingMovie = selectedContainer.querySelector(`[data-movie-id="${movie.movieId}"]`);
    if (existingMovie) {
        console.log(`Movie ${movie.name} already exists in selection.`);
        return;
    }

    // Create a movie item container
    // let movieItem = document.createElement("div");
    // movieItem.className = "selected-movie";
    // movieItem.dataset.movieId = String(movie.movieId);
    // movieItem.textContent = `${movie.name} (${movie.year})`; // Display text only

        let movieItem = document.createElement("div");
        movieItem.className = "selected-movie";
        movieItem.dataset.movieId = String(movie.movieId);

        // Create the movie poster image element
        let moviePoster = document.createElement("img");
        moviePoster.src = movie.backdrop_url; // Ensure `posterUrl` exists in your movie data
        moviePoster.alt = `${movie.name} Poster`;
        moviePoster.className = "movie-poster"; // Assign a CSS class for styling

        // Create the text element (title and year)
        let movieText = document.createElement("p");
        movieText.textContent = `${movie.name} (${movie.year})`;
        movieText.className = "movie-title"; // Assign a CSS class for styling

        // Append the poster and text inside the main div
        movieItem.appendChild(moviePoster);
        movieItem.appendChild(movieText);




    // Append the movie text to the container
    selectedContainer.appendChild(movieItem);

    console.log(`Movie ${movie.name} added successfully.`);
}

// Function to remove a movie from the selected container
function removeMovieFromSelection(movieId) {
    let container = document.getElementById("movieContainer");
    let movieDiv = container.querySelector(`[data-movie-id='${movieId}']`);
    if (movieDiv) {
        movieDiv.remove();
        console.log(`Movie with ID ${movieId} removed.`);
    }
}

// Hide suggestions when clicking outside
document.addEventListener("click", (event) => {
    if (!event.target.closest("#searchBox") && !event.target.closest("#suggestions")) {
        document.getElementById("suggestions").innerHTML = "";
    }
});

async function getRecommendations() {
    console.log("Selected movies before request:", Array.from(selectedMovies));

    if (selectedMovies.size !== 5) {
        alert("Please select exactly 5 movies.");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movies: Array.from(selectedMovies) })
        });

        if (!response.ok) {
            const errorData = await response.json();
            alert(errorData.error);
            return;
        }

        const data = await response.json();
        console.log("Recommendations:", data.recommendations);

        // Ensure the container exists
        let recommendationsContainer = document.getElementById("recommendations");
        if (!recommendationsContainer) {
            console.error("Error: #recommendations element not found!");
            return;
        }

        // Clear previous recommendations
        recommendationsContainer.innerHTML = "";

        // ✅ Display recommended movies with posters
        data.recommendations.forEach(movie => {
            let movieItem = document.createElement("div");
            movieItem.className = "recommended-movie";
            movieItem.dataset.movieId = String(movie.movieId);

            // Create the movie poster image element
            let moviePoster = document.createElement("img");
            moviePoster.src = movie.backdrop_url; // Ensure `backdrop_url` exists in your movie data
            moviePoster.alt = `${movie.name} Poster`;
            moviePoster.className = "movie-poster";

            // Create the text element (title and year)
            let movieText = document.createElement("p");
            movieText.textContent = `${movie.name} (${movie.year})`;
            movieText.className = "movie-title";

            // Append the poster and text inside the main div
            movieItem.appendChild(moviePoster);
            movieItem.appendChild(movieText);

            // Append to the recommendations container
            recommendationsContainer.appendChild(movieItem);
        });

    } catch (error) {
        console.error("Error fetching recommendations:", error);
    }
}

// Attach function to button click
// document.getElementById("recommendButton").onclick = getRecommendations;

function clearSelectedMovies() {
    let movieContainer = document.getElementById("movieContainer");
    let recommendationsContainer = document.getElementById("recommendations");

    movieContainer.innerHTML = ""; // Clears all selected movies
    recommendationsContainer.innerHTML = "";

    // Clear the selected movies set
    selectedMovies.clear();
}

// Load movies when page is ready
window.onload = loadMovies;