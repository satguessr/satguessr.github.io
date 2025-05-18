// === Constants & Initial Setup ===

// Capital landmarks coordinates for start screen
const capitalLandmarks = [
    { lat: 38.8895, lng: -77.0353 },  // Washington, D.C.
    { lat: 45.4236, lng: -75.7009 },  // Ottawa
    { lat: 51.5007, lng: -0.1246 },   // London
    { lat: 48.8584, lng: 2.2945 },    // Paris
    { lat: 52.5163, lng: 13.3777 },   // Berlin
    { lat: 41.8902, lng: 12.4922 },   // Rome
    { lat: 40.4169, lng: -3.7035 },   // Madrid
    { lat: 35.6586, lng: 139.7454 },  // Tokyo
    { lat: 39.9163, lng: 116.3972 },  // Beijing
    { lat: 55.7520, lng: 37.6175 },   // Moscow
    { lat: 28.6129, lng: 77.2295 },   // New Delhi
    { lat: -35.3081, lng: 149.1244 }, // Canberra
    { lat: -15.7939, lng: -47.8828 }, // Brasília
    { lat: 19.4326, lng: -99.1332 },  // Mexico City
    { lat: 30.0444, lng: 31.2357 },   // Cairo
    { lat: -1.2864, lng: 36.8172 },   // Nairobi
    { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
    { lat: 37.5663, lng: 126.9779 },  // Seoul
    { lat: 13.7563, lng: 100.5018 },  // Bangkok
    { lat: -6.1754, lng: 106.8272 }   // Jakarta
  ];
  
  // Pick a random capital for starting map view
  let startScreenCapital = capitalLandmarks[Math.floor(Math.random() * capitalLandmarks.length)];
  
  // Game data and config
  let cityData = null;
  const GameConfig = { seed: '', zoom: 13, roundCount: 5 };
  const GameState = { round: 0, locations: [], guesses: [], distances: [] };
  
  // === Load city data and enable start button ===
  $.getJSON('https://raw.githubusercontent.com/lmfmaier/cities-json/refs/heads/master/cities500.json', data => {
    cityData = data;
    $('#startBtn').prop('disabled', false).text('Start Game');
  });
  
  // === jQuery selectors for UI elements ===
  const $seedInput = $('#seedInput');
  const $distText = $('#dist');
  const $findistText = $('#findist');
  
  // === Handle seed input - only alphanumeric ===
  $seedInput.on('input', function () {
    this.value = this.value.replace(/[^a-zA-Z0-9]/g, '');
    GameConfig.seed = this.value;
  });
  
  // === Zoom level radio buttons logic using jQuery ===
  $('input[name="zoomLevel"]').on('change', function () {
    const zoomLevels = { far: 9, medium: 13, close: 20 };
    GameConfig.zoom = zoomLevels[this.value] || 13;
    SatMap.setView(startScreenCapital, GameConfig.zoom);
    console.log(`Selected mode: ${this.value}`);
  });
  
  // === Initialize Leaflet maps ===
  const SatMap = L.map('map', {
    center: startScreenCapital, zoom: GameConfig.zoom,
    dragging: false, zoomControl: false, scrollWheelZoom: false,
    touchZoom: false, doubleClickZoom: false
  }).addLayer(L.tileLayer('http://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; ARCGIS'
  }));
  
  const baseLayerOpts = {
    attribution: '&copy; OpenStreetMap contributors & CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
  };
  
  const GuessMap = L.map('guessMapCanvas', { center: [20, 0], zoom: 2 })
    .addLayer(L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', baseLayerOpts));
  const ResultMap = L.map('resultMapCanvas', { center: [20, 0], zoom: 2 })
    .addLayer(L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', baseLayerOpts));
  const FinalMap = L.map('finalMapCanvas', { center: [20, 0], zoom: 2 })
    .addLayer(L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', baseLayerOpts));
  
  // === UI display helper ===
  const elements = ["mainMenu", "guessButtons", "guessOverlay", "resultOverlay", "finalOverlay"];
  function showOnly(ids) {
    elements.forEach(id => $('#' + id).css('display', ids.includes(id) ? 'flex' : 'none'));
  }
  
  // === Game start logic ===
  function startGame() {
    // Generate location list using seeded RNG
    if (!GameConfig.seed) GameConfig.seed = Math.floor(Math.random() * 1e19).toString();
  
    GameState.locations = Array.from({ length: GameConfig.roundCount }, (_, i) => {
      const rng = new Math.seedrandom(GameConfig.seed + i);

      // Step 1: Filter the city list based on requirements
      const candidates = cityData.filter(city => {
        return (
          city.pop > 100000
          // add more checks as needed
        );
      });

      // Step 2: Select one at random from the filtered list
      return candidates[Math.floor(rng() * candidates.length)];
    });
  
    GameState.round = 0;
    SatMap.setView([parseFloat(GameState.locations[0].lat), parseFloat(GameState.locations[0].lon)], GameConfig.zoom);
    showOnly(["guessButtons"]);
    clearMarkers();
  }
  
  // === Guess overlay logic ===
  function guess() {
    showOnly(["guessOverlay"]);
    setTimeout(() => GuessMap.invalidateSize(), 100);
    GuessMap.setView([20, 0], 2);
  }
  
  // === Cancel guess ===
  function cancel() {
    showOnly(["guessButtons"]);
  }
  
  // === Markers management ===
  let markers = [];
  function clearMarkers() {
    markers.forEach(m => m.remove());
    markers = [];
  }
  
  // === GuessMap click handler ===
  let clickedCoords = [];
  GuessMap.on('click', e => {
    const lat = +e.latlng.lat.toFixed(2), lon = +e.latlng.lng.toFixed(2);
    console.log(`Clicked at: ${lat}, ${lon}`);
  
    clearMarkers();
    const marker = L.marker([lat, lon]).addTo(GuessMap).bindPopup(`You clicked at: ${lat}, ${lon}`).openPopup();
    markers.push(marker);
    clickedCoords = [lat, lon];
  });
  
  // === Haversine formula for distance (km) ===
  function getDistanceInKm([lat1, lon1], [lat2, lon2]) {
    const R = 6371; // Earth radius km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  
  // === Confirm guess and show results ===
  function confirmGuess() {
    if (!clickedCoords.length) return;
  
    const loc = GameState.locations[GameState.round];
    GameState.guesses.push(clickedCoords);
  
    const dist = +getDistanceInKm(clickedCoords, [parseFloat(loc.lat), parseFloat(loc.lon)]).toFixed(2);
    GameState.distances.push(dist);
  
    $distText.text(`Distance: ~ ${dist} km`);
  
    showOnly(["resultOverlay"]);
    setTimeout(() => ResultMap.invalidateSize(), 100);
    ResultMap.setView([20, 0], 2);
  
    clearMarkers();
  
    // Show guess marker
    markers.push(L.marker(GameState.guesses[GameState.round]).addTo(ResultMap).bindPopup(`Your guess`));
  
    // Show correct location marker with highlight
    const correctMarker = L.marker([loc.lat, loc.lon]).addTo(ResultMap).bindPopup(`Correct location`);
    correctMarker._icon.classList.add("huechange");
    markers.push(correctMarker);
  
    // Draw polyline between guess and correct location
    markers.push(L.polyline([GameState.guesses[GameState.round], [loc.lat, loc.lon]], { color: 'grey' }).addTo(ResultMap));
  }
  
  // === Continue to next round or show final results ===
  function continueGame() {
    GameState.round++;
    if (GameState.round >= GameConfig.roundCount) return results();
  
    const loc = GameState.locations[GameState.round];
    SatMap.setView([parseFloat(loc.lat), parseFloat(loc.lon)], GameConfig.zoom);
    showOnly(["guessButtons"]);
    clearMarkers();
  }
  
  // === Show results summary ===
  function results() {
    showOnly(["finalOverlay"]);
  
    // Calculate average distance
    const avgDistance = GameState.distances.reduce((a, b) => a + b) / GameState.distances.length || 0;
    $findistText.text(`Average Distance: ~ ${avgDistance.toFixed(2)} km`);
  
    setTimeout(() => FinalMap.invalidateSize(), 100);
    FinalMap.setView([20, 0], 2);
  
    clearMarkers();
  
    // Show all guesses, correct locations, and polylines
    for (let i = 0; i < GameConfig.roundCount; i++) {
      markers.push(L.marker(GameState.guesses[i]).addTo(FinalMap).bindPopup(`Your guess round ${i + 1}`));
  
      const loc = GameState.locations[i];
      const correctMarker = L.marker([loc.lat, loc.lon]).addTo(FinalMap).bindPopup(`Correct location round ${i + 1}`);
      correctMarker._icon.classList.add("huechange");
      markers.push(correctMarker);
  
      markers.push(L.polyline([GameState.guesses[i], [loc.lat, loc.lon]], { color: 'grey' }).addTo(FinalMap));
    }
  }
  
  // === Reset game and return to menu ===
  function returnMenu() {
    clearMarkers();
    GameConfig.seed = '';
    $seedInput.val('');
    Object.assign(GameState, { round: 0, locations: [], guesses: [], distances: [] });
    showOnly(["mainMenu"]);
  }
  
  // === Placeholder for save functionality ===
  function save() {
    alert("This feature will be added soon. 〈=^ェ^=〉");
  }
  