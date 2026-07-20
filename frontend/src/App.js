
import React, { useEffect, useRef, useState } from "react";

import mapboxgl from "mapbox-gl";
import axios from "axios";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = "pk.eyJ1Ijoia2FscHRyaXZlZGlpaSIsImEiOiJjbW8zZmVrNTgwZnBqMm9zZ3p2cXNiNXZpIn0.ckInskyKl-SisXmQgFZ5PA";

// 📍 Station → Coordinates mapping
const stationCoords = {
  "Paddington": [-0.1764, 51.5154],
  "Bond Street": [-0.1494, 51.5142],
  "Tottenham Court Road": [-0.1300, 51.5164],
  "Farringdon": [-0.1046, 51.5203],
  "Liverpool Street": [-0.0824, 51.5178],
  "Whitechapel": [-0.0597, 51.5194],
  "Stratford": [-0.0030, 51.5413],
  "Canary Wharf": [-0.0203, 51.5054],
  "Custom House": [0.0266, 51.5097],
  "Woolwich": [0.0700, 51.4916],
  "Abbey Wood": [0.1218, 51.4906],

  // 🔥 ADD THESE (from your console)
  "Maryland": [-0.005, 51.546],
  "Forest Gate": [0.025, 51.549],
  "Manor Park": [0.046, 51.552],
  "Ilford": [0.069, 51.5586],
  "Seven Kings": [0.096, 51.561],
  "Goodmayes": [0.111, 51.565],
  "Chadwell Heath": [0.129, 51.569],
  "Romford": [0.1826, 51.5752],
  "Gidea Park": [0.205, 51.582],
  "Harold Wood": [0.232, 51.592],
  "Brentwood": [0.301, 51.620],
  "Shenfield": [0.326, 51.6307]
};


function App() {
  const [lineStatus, setLineStatus] = useState("Checking...");

  const [crowdStats, setCrowdStats] = useState({
    high: 0,
    medium: 0,
    low: 0
  });

  const [insights, setInsights] = useState({
    busiest: "",
    quietest: ""
  });

  const mapContainer = useRef(null);
  const getCrowdLevel = (train) => {
    const minutes = (train.timeToStation || 0) / 60;
    const hour = new Date().getHours();

    let score = 0;

    // ⏰ Peak hours
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      score += 3;
    }

    // 🚆 Arrival time impact
    if (minutes < 2) score += 3;
    else if (minutes < 5) score += 2;
    else score += 1;

    // 🎯 Final decision
    if (score >= 5) return "🔴 High";
    if (score >= 3) return "🟠 Medium";
    return "🟢 Low";
  };
  const trainMarkers = useRef({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-0.1, 51.5],
      zoom: 10,
    });


    let interval; // ✅ DECLARE HERE (important)

    const loadTrains = () => {
      axios.get("https://elizabeth-line-live-tracker-production.up.railway.app/trains")
        .then(res => {
          let stats = { high: 0, medium: 0, low: 0 };

          let stationCounts = {};

          res.data.forEach(train => {
            const matchKey = Object.keys(stationCoords).find(name =>
              train.stationName.toLowerCase().includes(name.toLowerCase())
            );

            if (!matchKey) return;

            stationCounts[matchKey] = (stationCounts[matchKey] || 0) + 1;
          });
          let busiest = null;
          let quietest = null;

          Object.keys(stationCounts).forEach(station => {
            if (!busiest || stationCounts[station] > stationCounts[busiest]) {
              busiest = station;
            }

            if (!quietest || stationCounts[station] < stationCounts[quietest]) {
              quietest = station;
            }
          });

          setInsights({
            busiest,
            quietest
          });

          res.data.forEach(train => {
            const level = getCrowdLevel(train);

            if (level.includes("High") || level.includes("Rush")) stats.high++;
            else if (level.includes("Medium")) stats.medium++;
            else stats.low++;
          });

          setCrowdStats(stats);





          const uniqueStations = {};

          res.data.forEach(train => {
            const cleanName = train.stationName.toLowerCase();

            const matchKey = Object.keys(stationCoords).find(name =>
              cleanName.includes(name.toLowerCase())
            );

            if (!matchKey) {
              console.log("❌ Not matched:", train.stationName);
              return;
            }

            if (!uniqueStations[matchKey]) {
              uniqueStations[matchKey] = train;
            }
          });

          Object.values(uniqueStations).forEach(train => {
            const matchKey = Object.keys(stationCoords).find(name =>
              train.stationName.toLowerCase().includes(name.toLowerCase())
            );

            if (!matchKey) return;

            const coords = stationCoords[matchKey];

            const offset = (Math.random() - 0.5) * 0.01;

            const newLngLat = [
              coords[0] + offset,
              coords[1] + offset
            ];

            if (trainMarkers[matchKey]) {
              trainMarkers[matchKey].setLngLat(newLngLat);

              trainMarkers[matchKey].setPopup(
                new mapboxgl.Popup().setHTML(`
      <strong>${matchKey}</strong><br/>
      🚆 ${train.destinationName}<br/>
      ⏱ ${Math.round(train.timeToStation / 60)} min<br/>
      👥 ${getCrowdLevel(train)}<br/>
      📊 ${predictCrowd(train)}
    `)
              );

            } else {
              // 🆕 CREATE NEW marker
              const el = document.createElement("div");
              el.style.width = "12px";
              el.style.height = "12px";

              const crowd = getCrowdLevel(train);

              if (crowd.includes("High")) el.style.background = "red";
              else if (crowd.includes("Medium")) el.style.background = "orange";
              else el.style.background = "green";

              el.style.borderRadius = "50%";
              el.style.animation = crowd.includes("High")
                ? "pulse 1s infinite"
                : "none";
              {
                insights.busiest && (
                  <div style={{
                    position: "absolute",
                    top: "60px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "red",
                    color: "white",
                    padding: "8px 20px",
                    borderRadius: "8px",
                    zIndex: 2
                  }}>
                    🚨 Peak Crowd at {insights.busiest}
                  </div>
                )
              }
              const marker = new mapboxgl.Marker(el)
                .setLngLat(newLngLat)
                .setPopup(
                  new mapboxgl.Popup().setHTML(`
        <strong>${matchKey}</strong><br/>
        🚆 ${train.destinationName}<br/>
        ⏱ ${Math.round(train.timeToStation / 60)} min<br/>
        👥 ${getCrowdLevel(train)}<br/>
        📊 ${predictCrowd(train)}
      `)
                )
                .addTo(map);

              trainMarkers[matchKey] = marker;
            }
          });
        })
        .catch(err => console.error(err));
    };

    // ✅ RUN ONLY AFTER MAP LOADS
    map.on("load", () => {

      loadTrains();
      axios.get("https://api.tfl.gov.uk/Line/elizabeth/Status")
        .then(res => {
          const status = res.data[0].lineStatuses[0].statusSeverityDescription;
          setLineStatus(status);
        })
        .catch(() => setLineStatus("Unavailable"));

      interval = setInterval(loadTrains, 10000); // assign here
    });

    return () => {
      if (interval) clearInterval(interval); // ✅ SAFE CLEANUP
      map.remove();
    };

  }, []);

  return (
    <>
      {/* 🔵 LEFT PANEL */}
      <div style={{
        position: "absolute",
        left: "10px",
        top: "80px",
        zIndex: 2,
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "15px",
        borderRadius: "10px",
        width: "220px"
      }}>
        <h3>📊 Crowd Stats</h3>
        <h4>🎨 Legend</h4>
        <p>🔴 High Crowd</p>
        <p>🟠 Medium Crowd</p>
        <p>🟢 Low Crowd</p>

        <hr style={{ margin: "10px 0", borderColor: "#555" }} />

        <h3>🚇 Tube Report</h3>
        <p>
          Status:{" "}
          <span style={{
            color: lineStatus === "Good Service" ? "lightgreen" : "red",
            fontWeight: "bold"
          }}>
            {lineStatus}
          </span>
        </p>
      </div>


      {/* 🔝 TITLE */}
      <h2 style={{
        position: "absolute",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1,
        color: "white",
        background: "rgba(0,0,0,0.7)",
        padding: "10px 20px",
        borderRadius: "10px"
      }}>
        🚆 Elizabeth Line Live Tracker
      </h2>

      {/* 🗺️ MAP */}
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100vh" }}
      />
    </>
  );
}

export default App;