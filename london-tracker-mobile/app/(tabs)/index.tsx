import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, {
  Callout,
  Circle,
  Marker,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import axios from "axios";

type CrowdLevel = "High" | "Medium" | "Low";

type TrainApiItem = {
  id?: string;
  vehicleId?: string;
  stationName?: string;
  destinationName?: string;
  timeToStation?: number;
  expectedArrival?: string;
  platformName?: string;
};

type DisplayTrain = {
  id: string;
  station: string;
  destination: string;
  minutes: number;
  crowd: CrowdLevel;
  latitude: number;
  longitude: number;
  platform: string;
};

type CrowdStats = {
  high: number;
  medium: number;
  low: number;
};

const API_URL =
  "https://elizabeth-line-live-tracker-production.up.railway.app/trains";

const STATUS_URL = "https://api.tfl.gov.uk/Line/elizabeth/Status";

const stationCoords: Record<
  string,
  { latitude: number; longitude: number }
> = {
  Paddington: { latitude: 51.5154, longitude: -0.1764 },
  "Bond Street": { latitude: 51.5142, longitude: -0.1494 },
  "Tottenham Court Road": { latitude: 51.5164, longitude: -0.13 },
  Farringdon: { latitude: 51.5203, longitude: -0.1046 },
  "Liverpool Street": { latitude: 51.5178, longitude: -0.0824 },
  Whitechapel: { latitude: 51.5194, longitude: -0.0597 },
  Stratford: { latitude: 51.5413, longitude: -0.003 },
  "Canary Wharf": { latitude: 51.5054, longitude: -0.0203 },
  "Custom House": { latitude: 51.5097, longitude: 0.0266 },
  Woolwich: { latitude: 51.4916, longitude: 0.07 },
  "Abbey Wood": { latitude: 51.4906, longitude: 0.1218 },
  Maryland: { latitude: 51.546, longitude: -0.005 },
  "Forest Gate": { latitude: 51.549, longitude: 0.025 },
  "Manor Park": { latitude: 51.552, longitude: 0.046 },
  Ilford: { latitude: 51.5586, longitude: 0.069 },
  "Seven Kings": { latitude: 51.561, longitude: 0.096 },
  Goodmayes: { latitude: 51.565, longitude: 0.111 },
  "Chadwell Heath": { latitude: 51.569, longitude: 0.129 },
  Romford: { latitude: 51.5752, longitude: 0.1826 },
  "Gidea Park": { latitude: 51.582, longitude: 0.205 },
  "Harold Wood": { latitude: 51.592, longitude: 0.232 },
  Brentwood: { latitude: 51.62, longitude: 0.301 },
  Shenfield: { latitude: 51.6307, longitude: 0.326 },
};

const INITIAL_REGION: Region = {
  latitude: 51.52,
  longitude: -0.03,
  latitudeDelta: 0.22,
  longitudeDelta: 0.42,
};

const DEMO_TRAINS: TrainApiItem[] = [
  {
    id: "demo-1",
    stationName: "Paddington Rail Station",
    destinationName: "Abbey Wood",
    timeToStation: 90,
    platformName: "Platform B",
  },
  {
    id: "demo-2",
    stationName: "Bond Street Station",
    destinationName: "Shenfield",
    timeToStation: 210,
    platformName: "Platform A",
  },
  {
    id: "demo-3",
    stationName: "Tottenham Court Road Station",
    destinationName: "Abbey Wood",
    timeToStation: 70,
    platformName: "Platform B",
  },
  {
    id: "demo-4",
    stationName: "Liverpool Street Station",
    destinationName: "Heathrow Terminal 5",
    timeToStation: 260,
    platformName: "Platform A",
  },
  {
    id: "demo-5",
    stationName: "Whitechapel Station",
    destinationName: "Paddington",
    timeToStation: 420,
    platformName: "Platform B",
  },
  {
    id: "demo-6",
    stationName: "Canary Wharf Station",
    destinationName: "Shenfield",
    timeToStation: 130,
    platformName: "Platform A",
  },
  {
    id: "demo-7",
    stationName: "Woolwich Station",
    destinationName: "Paddington",
    timeToStation: 330,
    platformName: "Platform B",
  },
  {
    id: "demo-8",
    stationName: "Abbey Wood Station",
    destinationName: "Heathrow Terminal 4",
    timeToStation: 500,
    platformName: "Platform 3",
  },
];

function findStationName(value?: string): string | null {
  if (!value) return null;

  const cleanValue = value.toLowerCase();

  return (
    Object.keys(stationCoords).find((station) =>
      cleanValue.includes(station.toLowerCase())
    ) ?? null
  );
}

function calculateCrowd(train: TrainApiItem): CrowdLevel {
  const minutes = Math.max(0, Number(train.timeToStation ?? 0)) / 60;
  const hour = new Date().getHours();

  let score = 0;

  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    score += 3;
  }

  if (minutes < 2) score += 3;
  else if (minutes < 5) score += 2;
  else score += 1;

  if (score >= 5) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

function crowdColour(level: CrowdLevel): string {
  if (level === "High") return "#ff3b5c";
  if (level === "Medium") return "#ff9f0a";
  return "#22d86f";
}

function heatFill(level: CrowdLevel): string {
  if (level === "High") return "rgba(255,59,92,0.24)";
  if (level === "Medium") return "rgba(255,159,10,0.22)";
  return "rgba(34,216,111,0.16)";
}

function heatStroke(level: CrowdLevel): string {
  if (level === "High") return "rgba(255,59,92,0.75)";
  if (level === "Medium") return "rgba(255,159,10,0.7)";
  return "rgba(34,216,111,0.55)";
}

function createPrediction(stats: CrowdStats): {
  label: string;
  colour: string;
} {
  const hour = new Date().getHours();
  let score = stats.high * 3 + stats.medium * 2 + stats.low;

  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    score += 20;
  }

  if (score > 50) {
    return { label: "Heavy crowd expected", colour: "#ff9f0a" };
  }

  if (score > 25) {
    return { label: "Moderate crowd", colour: "#ffd60a" };
  }

  return { label: "Smooth travel", colour: "#22d86f" };
}

export default function HomeScreen() {
  const [trains, setTrains] = useState<DisplayTrain[]>([]);
  const [lineStatus, setLineStatus] = useState("Checking...");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const crowdStats = useMemo<CrowdStats>(() => {
    return trains.reduce(
      (stats, train) => {
        if (train.crowd === "High") stats.high += 1;
        else if (train.crowd === "Medium") stats.medium += 1;
        else stats.low += 1;

        return stats;
      },
      { high: 0, medium: 0, low: 0 }
    );
  }, [trains]);

  const prediction = useMemo(
    () => createPrediction(crowdStats),
    [crowdStats]
  );

  const loadStatus = useCallback(async () => {
    try {
      const response = await axios.get(STATUS_URL, {
        timeout: 12000,
      });

      const status =
        response.data?.[0]?.lineStatuses?.[0]
          ?.statusSeverityDescription ?? "Unavailable";

      setLineStatus(status);
    } catch {
      setLineStatus("Unavailable");
    }
  }, []);

  const transformTrains = useCallback(
    (items: TrainApiItem[]): DisplayTrain[] => {
      const stationMap = new Map<string, DisplayTrain>();

      items.forEach((train, index) => {
        const station = findStationName(train.stationName);
        if (!station) return;

        const coords = stationCoords[station];
        const minutes = Math.max(
          0,
          Math.round(Number(train.timeToStation ?? 0) / 60)
        );

        const displayTrain: DisplayTrain = {
          id:
            train.id ??
            train.vehicleId ??
            `${station}-${train.destinationName}-${index}`,
          station,
          destination: train.destinationName ?? "Unknown destination",
          minutes,
          crowd: calculateCrowd(train),
          latitude: coords.latitude,
          longitude: coords.longitude,
          platform: train.platformName ?? "Platform unavailable",
        };

        const existing = stationMap.get(station);

        if (!existing || displayTrain.minutes < existing.minutes) {
          stationMap.set(station, displayTrain);
        }
      });

      return Array.from(stationMap.values()).sort(
        (a, b) => a.minutes - b.minutes
      );
    },
    []
  );

  const loadData = useCallback(async () => {
    setErrorMessage("");

    try {
      const response = await axios.get<TrainApiItem[]>(API_URL, {
        timeout: 15000,
      });

      const liveItems = Array.isArray(response.data) ? response.data : [];
      const liveTrains = transformTrains(liveItems);

      if (liveTrains.length > 0) {
        setTrains(liveTrains);
        setUsingDemoData(false);
      } else {
        setTrains(transformTrains(DEMO_TRAINS));
        setUsingDemoData(true);
        setErrorMessage(
          "No live arrivals are currently available. Showing clearly labelled demo data."
        );
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.log("Train API error:", error);

      setTrains(transformTrains(DEMO_TRAINS));
      setUsingDemoData(true);
      setLastUpdated(new Date());
      setErrorMessage(
        "The live API could not be reached. Showing clearly labelled demo data."
      );
    }
  }, [transformTrains]);

  const refreshEverything = useCallback(async () => {
    setRefreshing(true);

    await Promise.all([loadData(), loadStatus()]);

    setRefreshing(false);
    setLoading(false);
  }, [loadData, loadStatus]);

  useEffect(() => {
    let active = true;

    const start = async () => {
      await Promise.all([loadData(), loadStatus()]);

      if (active) {
        setLoading(false);
      }
    };

    start();

    const interval = setInterval(() => {
      loadData();
      loadStatus();
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loadData, loadStatus]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFillObject}
          initialRegion={INITIAL_REGION}
          showsCompass
          showsScale
          showsUserLocation
        >
          {/* Mobile heat overlay: circles represent congestion intensity. */}
          {trains.map((train) => (
            <Circle
              key={`heat-${train.id}`}
              center={{
                latitude: train.latitude,
                longitude: train.longitude,
              }}
              radius={
                train.crowd === "High"
                  ? 1600
                  : train.crowd === "Medium"
                    ? 1200
                    : 800
              }
              fillColor={heatFill(train.crowd)}
              strokeColor={heatStroke(train.crowd)}
              strokeWidth={1}
            />
          ))}

          {trains.map((train) => (
            <Marker
              key={train.id}
              coordinate={{
                latitude: train.latitude,
                longitude: train.longitude,
              }}
              pinColor={crowdColour(train.crowd)}
              tracksViewChanges={false}
            >
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{train.station}</Text>

                  <Text style={styles.calloutText}>
                    🚆 To: {train.destination}
                  </Text>

                  <Text style={styles.calloutText}>
                    ⏱ Arrival:{" "}
                    {train.minutes <= 0
                      ? "Due"
                      : `${train.minutes} min`}
                  </Text>

                  <Text style={styles.calloutText}>
                    👥 Crowd: {train.crowd}
                  </Text>

                  <Text style={styles.calloutText}>
                    🚉 {train.platform}
                  </Text>

                  {usingDemoData && (
                    <Text style={styles.demoCallout}>Demo information</Text>
                  )}
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        <View style={styles.header}>
          <Text style={styles.headerIcon}>🚆</Text>

          <View>
            <Text style={styles.headerTitle}>Elizabeth Line</Text>
            <Text style={styles.headerSubtitle}>Live intelligence</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#7d4dff" />
            <Text style={styles.loadingText}>Loading train information…</Text>
          </View>
        ) : (
          <View style={styles.bottomSheet}>
            <View style={styles.dragHandle} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refreshEverything}
                  tintColor="#ffffff"
                />
              }
            >
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>Network overview</Text>

                  <Text style={styles.updateText}>
                    {lastUpdated
                      ? `Updated ${lastUpdated.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Waiting for update"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.liveBadge,
                    usingDemoData && styles.demoBadge,
                  ]}
                >
                  <Text style={styles.liveBadgeText}>
                    {usingDemoData ? "DEMO" : "LIVE"}
                  </Text>
                </View>
              </View>

              {errorMessage ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeText}>{errorMessage}</Text>
                </View>
              ) : null}

              <View style={styles.statusCard}>
                <View>
                  <Text style={styles.cardLabel}>Elizabeth line status</Text>
                  <Text
                    style={[
                      styles.statusValue,
                      {
                        color:
                          lineStatus === "Good Service"
                            ? "#22d86f"
                            : "#ff9f0a",
                      },
                    ]}
                  >
                    {lineStatus}
                  </Text>
                </View>

                <Text style={styles.statusIcon}>
                  {lineStatus === "Good Service" ? "✓" : "!"}
                </Text>
              </View>

              <View style={styles.predictionCard}>
                <Text style={styles.cardLabel}>
                  Predictive crowd estimate
                </Text>

                <Text
                  style={[
                    styles.predictionValue,
                    { color: prediction.colour },
                  ]}
                >
                  {prediction.label}
                </Text>

                <Text style={styles.disclaimer}>
                  Based on arrival frequency, time of day and current train
                  density. This is an estimate, not official passenger-count
                  data.
                </Text>
              </View>

              <View style={styles.statsRow}>
                <StatCard
                  label="High"
                  value={crowdStats.high}
                  colour="#ff3b5c"
                />

                <StatCard
                  label="Medium"
                  value={crowdStats.medium}
                  colour="#ff9f0a"
                />

                <StatCard
                  label="Low"
                  value={crowdStats.low}
                  colour="#22d86f"
                />
              </View>

              <View style={styles.legend}>
                <Text style={styles.legendTitle}>Map key</Text>
                <Text style={styles.legendText}>
                  Coloured pins show stations. Transparent circles show the
                  estimated congestion zone.
                </Text>
              </View>

              <Text style={styles.arrivalsHeading}>Next arrivals</Text>

              {trains.slice(0, 8).map((train) => (
                <View key={`row-${train.id}`} style={styles.arrivalRow}>
                  <View
                    style={[
                      styles.crowdDot,
                      { backgroundColor: crowdColour(train.crowd) },
                    ]}
                  />

                  <View style={styles.arrivalContent}>
                    <Text style={styles.stationName}>
                      {train.station}
                    </Text>

                    <Text style={styles.destinationText}>
                      To {train.destination}
                    </Text>
                  </View>

                  <View style={styles.arrivalTimeBox}>
                    <Text style={styles.arrivalTime}>
                      {train.minutes <= 0 ? "Due" : train.minutes}
                    </Text>

                    {train.minutes > 0 && (
                      <Text style={styles.minutesText}>min</Text>
                    )}
                  </View>
                </View>
              ))}

              <View style={styles.bottomSpacing} />
            </ScrollView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statDot, { backgroundColor: colour }]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const screenHeight = Dimensions.get("window").height;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b0d12",
  },

  container: {
    flex: 1,
    backgroundColor: "#0b0d12",
  },

  header: {
    position: "absolute",
    top: 18,
    alignSelf: "center",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(12,14,20,0.92)",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },

  headerIcon: {
    fontSize: 25,
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: "#aab0bf",
    fontSize: 11,
    marginTop: 1,
  },

  loadingCard: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    backgroundColor: "rgba(10,12,18,0.94)",
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: "center",
  },

  loadingText: {
    color: "#ffffff",
    fontSize: 14,
    marginTop: 12,
  },

  bottomSheet: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: screenHeight * 0.48,
    backgroundColor: "rgba(11,13,19,0.97)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
  },

  dragHandle: {
    width: 46,
    height: 5,
    borderRadius: 10,
    backgroundColor: "#4d5260",
    alignSelf: "center",
    marginBottom: 14,
  },

  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sheetTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },

  updateText: {
    color: "#8f96a7",
    fontSize: 12,
    marginTop: 3,
  },

  liveBadge: {
    backgroundColor: "rgba(34,216,111,0.15)",
    borderColor: "rgba(34,216,111,0.5)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  demoBadge: {
    backgroundColor: "rgba(255,159,10,0.15)",
    borderColor: "rgba(255,159,10,0.55)",
  },

  liveBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
  },

  noticeCard: {
    backgroundColor: "rgba(255,159,10,0.1)",
    borderColor: "rgba(255,159,10,0.35)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },

  noticeText: {
    color: "#ffd28a",
    fontSize: 12,
    lineHeight: 17,
  },

  statusCard: {
    backgroundColor: "#171a22",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  cardLabel: {
    color: "#9097a8",
    fontSize: 12,
    fontWeight: "600",
  },

  statusValue: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 6,
  },

  statusIcon: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },

  predictionCard: {
    backgroundColor: "#171a22",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  predictionValue: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 6,
  },

  disclaimer: {
    color: "#8f96a7",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#171a22",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },

  statDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    marginBottom: 7,
  },

  statValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },

  statLabel: {
    color: "#9299aa",
    fontSize: 11,
    marginTop: 2,
  },

  legend: {
    backgroundColor: "#171a22",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },

  legendTitle: {
    color: "#ffffff",
    fontWeight: "800",
    marginBottom: 5,
  },

  legendText: {
    color: "#949bad",
    fontSize: 12,
    lineHeight: 17,
  },

  arrivalsHeading: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },

  arrivalRow: {
    backgroundColor: "#171a22",
    borderRadius: 16,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
  },

  crowdDot: {
    width: 11,
    height: 11,
    borderRadius: 10,
    marginRight: 11,
  },

  arrivalContent: {
    flex: 1,
  },

  stationName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  destinationText: {
    color: "#9299aa",
    fontSize: 12,
    marginTop: 3,
  },

  arrivalTimeBox: {
    minWidth: 48,
    alignItems: "center",
  },

  arrivalTime: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
  },

  minutesText: {
    color: "#8e95a6",
    fontSize: 10,
  },

  callout: {
    width: 220,
    backgroundColor: "#11141b",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#343947",
  },

  calloutTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },

  calloutText: {
    color: "#d8dbe3",
    fontSize: 13,
    marginTop: 4,
  },

  demoCallout: {
    color: "#ffb84d",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
  },

  bottomSpacing: {
    height: 26,
  },
});