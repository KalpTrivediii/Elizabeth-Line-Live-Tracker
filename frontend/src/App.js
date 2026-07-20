import React, { useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie
} from "recharts";
import mapboxgl from "mapbox-gl";
import axios from "axios";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken =
  "pk.eyJ1Ijoia2FscHRyaXZlZGlpaSIsImEiOiJjbW8zZmVrNTgwZnBqMm9zZ3p2cXNiNXZpIn0.ckInskyKl-SisXmQgFZ5PA";

const stationCoords = {
  Paddington: [-0.1764, 51.5154],
  "Bond Street": [-0.1494, 51.5142],
  "Tottenham Court Road": [-0.13, 51.5164],
  Farringdon: [-0.1046, 51.5203],
  "Liverpool Street": [-0.0824, 51.5178],
  Whitechapel: [-0.0597, 51.5194],
  Stratford: [-0.003, 51.5413],
  "Canary Wharf": [-0.0203, 51.5054],
  "Custom House": [0.0266, 51.5097],
  Woolwich: [0.07, 51.4916],
  "Abbey Wood": [0.1218, 51.4906],
};

function App() {
   const [history, setHistory] = useState([]);
  const [lineStatus, setLineStatus] = useState("Checking...");
  const [crowdStats, setCrowdStats] = useState({
 
    high: 0,
    medium: 0,
    low: 0,
  });

  const [prediction, setPrediction] = useState({
    label: "",
    color: "white",
  });

  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  // 🔥 Crowd Logic
  const getCrowdLevel = (train) => {
    const minutes = (train.timeToStation || 0) / 60;
    const hour = new Date().getHours();

    let score = 0;

    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) score += 3;
    if (minutes < 2) score += 3;
    else if (minutes < 5) score += 2;
    else score += 1;

    if (score >= 5) return "High";
    if (score >= 3) return "Medium";
    return "Low";
  };

  // 🤖 AI Prediction
  const predictCrowd = (stats) => {
    const total = stats.high * 3 + stats.medium * 2 + stats.low;
    const hour = new Date().getHours();

    let score = total;

    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      score += 20;
    }

    if (score > 80)
      return { label: "🔥 Extreme Rush Incoming", color: "red" };
    if (score > 50)
      return { label: "⚠️ Heavy Crowd Expected", color: "orange" };
    if (score > 25)
      return { label: "🟡 Moderate Crowd", color: "yellow" };

    return { label: "🟢 Smooth Travel", color: "lightgreen" };
  };

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-0.1, 51.5],
      zoom: 10,
    });

    mapRef.current = map;

    map.on("load", () => {
      // 🔥 Heatmap setup
      map.addSource("heat", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "heat-layer",
        type: "heatmap",
        source: "heat",
        paint: {
          "heatmap-intensity": 1.5,
          "heatmap-radius": 35,
          "heatmap-opacity": 0.7,
        },
      });

      loadData();
      setInterval(loadData, 10000);

      // 🚇 Status
      axios
        .get("https://api.tfl.gov.uk/Line/elizabeth/Status")
        .then((res) => {
          setLineStatus(
            res.data[0]?.lineStatuses[0]?.statusSeverityDescription ||
              "Unavailable"
          );
        });
    });

    const loadData = () => {
      axios
        .get(
          "https://elizabeth-line-live-tracker-production.up.railway.app/trains"
        )
        .then((res) => {
          let stats = { high: 0, medium: 0, low: 0 };
          let heatFeatures = [];

          res.data.forEach((train) => {
            const match = Object.keys(stationCoords).find((s) =>
              train.stationName.toLowerCase().includes(s.toLowerCase())
            );

            if (!match) return;

            const coords = stationCoords[match];
            const crowd = getCrowdLevel(train);

            // stats
            if (crowd === "High") stats.high++;
            else if (crowd === "Medium") stats.medium++;
            else stats.low++;

            // heatmap
            heatFeatures.push({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: coords,
              },
              properties: {
                intensity:
                  crowd === "High" ? 3 : crowd === "Medium" ? 2 : 1,
              },
            });

            // marker
            if (!markersRef.current[match]) {
              const el = document.createElement("div");

              el.style.width = "14px";
              el.style.height = "14px";
              el.style.borderRadius = "50%";
              el.style.background =
                crowd === "High"
                  ? "red"
                  : crowd === "Medium"
                  ? "orange"
                  : "green";

              el.style.boxShadow = "0 0 10px white";

              const marker = new mapboxgl.Marker(el)
                .setLngLat(coords)
                .setPopup(
                  new mapboxgl.Popup().setHTML(`
                    <strong>${match}</strong><br/>
                    🚆 ${train.destinationName}<br/>
                    ⏱ ${Math.round(train.timeToStation / 60)} min<br/>
                    👥 ${crowd}
                  `)
                )
                .addTo(mapRef.current);

              markersRef.current[match] = marker;
            }
          });

          setCrowdStats(stats);
          setPrediction(predictCrowd(stats));
setHistory(prev => [
  ...prev.slice(-10),
  {
    time: new Date().toLocaleTimeString(),
    high: stats.high,
    medium: stats.medium,
    low: stats.low
  }
]);
          // update heatmap
          const source = mapRef.current.getSource("heat");
          if (source) {
            source.setData({
              type: "FeatureCollection",
              features: heatFeatures,
            });
          }
        });
    };

    return () => map.remove();
  }, []);

  return (
    <>
      {/* LEFT PANEL */}
      <div
        style={{
          position: "absolute",
          left: "10px",
          top: "80px",
          zIndex: 2,
          background: "rgba(0,0,0,0.85)",
          color: "white",
          padding: "15px",
          borderRadius: "12px",
          width: "240px",
        }}
      >
        <h3>📊 Crowd Stats</h3>
        <p>🔴 High: {crowdStats.high}</p>
        <p>🟠 Medium: {crowdStats.medium}</p>
        <p>🟢 Low: {crowdStats.low}</p>

        <hr />

        <h3>🤖 AI Prediction</h3>
        <p style={{ color: prediction.color }}>{prediction.label}</p>

        <hr />

        <h3>🚇 Status</h3>
        <p>{lineStatus}</p>
      </div>

      {/* TITLE */}
      <h2
        style={{
          position: "absolute",
          top: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2,
          color: "white",
          background: "rgba(0,0,0,0.8)",
          padding: "10px 20px",
          borderRadius: "12px",
        }}
      >
        🚆 Elizabeth Line AI Tracker
      </h2>

      {/* MAP */}
      <div
        ref={mapContainer}
        style={{ width: "100%", height: "100vh" }}
        
      />
    <div style={{
      position: "absolute",
      bottom: "10px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "90%",
      background: "rgba(0,0,0,0.85)",
      padding: "20px",
      borderRadius: "15px",
      color: "white",
      display: "flex",
      gap: "20px",
      zIndex: 2
    }}>

      {/* LINE GRAPH */}
      <div style={{ width: "70%", height: 200 }}>
        <h3>📈 Live Crowd Trend</h3>
        <ResponsiveContainer>
          <LineChart data={history}>
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="high" stroke="red" />
            <Line type="monotone" dataKey="medium" stroke="orange" />
            <Line type="monotone" dataKey="low" stroke="green" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* PIE GRAPH */}
      <div style={{ width: "30%", height: 200 }}>
        <h3>🧠 Distribution</h3>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={[
                { name: "High", value: crowdStats.high },
                { name: "Medium", value: crowdStats.medium },
                { name: "Low", value: crowdStats.low },
              ]}
              dataKey="value"
              nameKey="name"
              outerRadius={70}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

    </div>
  </>
);
  
}

export default App;