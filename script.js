// Your MapTiler API key
const key = '0lS9TD8Oeb4RcxfppNpY'; // Replace with your API key

// Create the main gameplay map
const map = L.map('map', {
  center: [51.505, -0.09],
  zoom: 13,
  dragging: false,
  zoomControl: false,
  scrollWheelZoom: false,
  touchZoom: false,
  doubleClickZoom: false
});
L.tileLayer(`https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${key}`, {
    attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> contributors'
}).addTo(map);

// Create the guess map
const guessMap = L.map('map2', { center: [20, 0], zoom: 2 });
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors & CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(guessMap);

// Create the result map
const resultMap = L.map('map3', { center: [20, 0], zoom: 2 });
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors & CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(resultMap);

let markers = [];

// Function to clear all markers
function clearMarkers() {
    markers.forEach(marker => marker.remove());
    markers = []; // Reset the markers array
}

let clickedCoords = []
let currentMarker;

// Event listener for map click
guessMap.on('click', function (e) {
    const lat = e.latlng.lat.toFixed(2);
    const lon = e.latlng.lng.toFixed(2);
    console.log(`Latitude: ${lat}, Longitude: ${lon}`);
    
    clearMarkers();
    
    currentMarker = L.marker([lat, lon]).addTo(guessMap)
      .bindPopup(`You clicked at: ${lat}, ${lon}`)
      .openPopup();
    markers.push(currentMarker);
    
    clickedCoords = [lat, lon];
});

let gamestate = {
    seed: 0,
    round: 0,
    coords: [],
    guesses: [],
    distances: []
}

let elids = ["guessButton", "mainMenu", "guessMap", "resultMap"];

function showOnly(ids){
    for (let id of elids) {
        document.getElementById(id).style.display = ids.includes(id) ? 'flex' : 'none';
    }
}

// Bounding boxes for landmasses with calculated areas
const landBoundingBoxes = [
    { name: "North America", latMin: 24.396308, latMax: 49.384358, lonMin: -125.0, lonMax: -66.93457 },
    { name: "South America", latMin: -55.0, latMax: 13.0, lonMin: -81.0, lonMax: -34.0 },
    { name: "Europe", latMin: 35.0, latMax: 71.0, lonMin: -25.0, lonMax: 40.0 },
    { name: "Africa", latMin: -37.0, latMax: 37.5, lonMin: -18.0, lonMax: 51.0 },
    { name: "Asia", latMin: 10.0, latMax: 75.0, lonMin: 60.0, lonMax: 150.0 },
    { name: "Australia", latMin: -55.0, latMax: -10.0, lonMin: 112.0, lonMax: 155.0 }
];

// Calculate the area of each bounding box
function calculateArea(latMin, latMax, lonMin, lonMax) {
    return (latMax - latMin) * (lonMax - lonMin);
}

// Add area and weight to each bounding box
landBoundingBoxes.forEach(box => {
    box.area = calculateArea(box.latMin, box.latMax, box.lonMin, box.lonMax);
});

const totalArea = landBoundingBoxes.reduce((total, box) => total + box.area, 0);

// Assign weight to each bounding box
landBoundingBoxes.forEach(box => {
    box.weight = box.area / totalArea;
});

// Function to select a bounding box based on weighted probabilities
function selectBoundingBoxWeighted() {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (let box of landBoundingBoxes) {
        cumulativeWeight += box.weight;
        if (random <= cumulativeWeight) {
            return box;
        }
    }
}

// Function to generate a random coordinate within a selected bounding box
function generateRandomCoordinateInBox(box) {
    const lat = Math.random() * (box.latMax - box.latMin) + box.latMin;
    const lon = Math.random() * (box.lonMax - box.lonMin) + box.lonMin;
    return { latitude: lat, longitude: lon };
}

function generateCoords() {
    const selectedBox = selectBoundingBoxWeighted();
    return generateRandomCoordinateInBox(selectedBox);
}

async function isLikelyOnLand(lat, lon) {
    const url = `https://api.maptiler.com/geocoding/reverse.json?lat=${lat}&lon=${lon}&key=${key}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const address = data.features[0].properties;
            if (address.country || address.city || address.state) {
                return true;  // Likely on land
            } else {
                return false;  // Likely water
            }
        }
        return false;  // No address, likely water
    } catch (error) {
        console.error('Error in geocoding:', error);
        return false;  // Error case, assume water
    }
}

function startGame() {
    gamestate.seed = Number(document.getElementById('seedInput').value);
    const generatedCoordinate = generateCoords();
    gamestate.coords.push([generatedCoordinate.latitude, generatedCoordinate.longitude]);

    map.setView(new L.LatLng(gamestate.coords[gamestate.round][0], gamestate.coords[gamestate.round][1]), 13);
    showOnly(["guessButton"]);
}

function guess() {
    showOnly(["guessMap"]);
    setTimeout(() => {
        guessMap.invalidateSize();  // Important for map sizing after display change
    }, 100);
    guessMap.setView(new L.LatLng(20, 0), 2);
}

let guessMark;
let coordMark;

function confirmGuess() {
    if (clickedCoords.length > 0) {
        gamestate.guesses.push(clickedCoords);
        showOnly(["resultMap"]);
        setTimeout(() => {
            resultMap.invalidateSize();  // Important for map sizing after display change
        }, 100);
        
        clearMarkers();
        guessMark = L.marker(gamestate.guesses[gamestate.round]).addTo(resultMap)
          .bindPopup(`This is where you guessed`)
          .openPopup();
        markers.push(guessMark);
        
        coordMark = L.marker(gamestate.coords[gamestate.round]).addTo(resultMap)
          .bindPopup(`This is the correct location`)
          .openPopup();
        markers.push(coordMark);
    }
}

function continueGame() {
    gamestate.round += 1;
    if (gamestate.round > 5) {
        gamestate = { seed: 0, round: 0, coords: [], guesses: [], distances: [] };
        showOnly(["mainMenu"]);
    } else {
        startGame();
    }
}
