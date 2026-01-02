import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    name?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface CountryMapProps {
  targetCountry: string;
  guessedBorders: string[];
  allBorders: string[];
  gameOver: boolean;
  showOutlines?: boolean;
  wrongGuesses?: string[];
}

// Map game country names to TopoJSON names where they differ
const nameMapping: Record<string, string> = {
  "United States": "United States of America",
  "Czech Republic": "Czechia",
  "Democratic Republic of the Congo": "Dem. Rep. Congo",
  "Republic of the Congo": "Congo",
  "Central African Republic": "Central African Rep.",
  "South Sudan": "S. Sudan",
  "Ivory Coast": "Côte d'Ivoire",
  "Eswatini": "eSwatini",
  "Bosnia and Herzegovina": "Bosnia and Herz.",
  "North Macedonia": "Macedonia",
  "East Timor": "Timor-Leste",
  "Western Sahara": "W. Sahara",
};

// Filter out overseas territories for certain countries to fix map scale
// Returns true if the polygon should be KEPT
function isMainlandPolygon(countryName: string, coords: number[][]): boolean {
  if (countryName !== 'France') return true;

  // France mainland bounding box (approximate)
  // Latitude: ~42°N to ~51°N, Longitude: ~-5°W to ~10°E
  const mainlandBounds = {
    minLon: -10,
    maxLon: 15,
    minLat: 40,
    maxLat: 52,
  };

  // Check if the centroid of the polygon is within mainland bounds
  let sumLon = 0, sumLat = 0;
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  const centroidLon = sumLon / coords.length;
  const centroidLat = sumLat / coords.length;

  return (
    centroidLon >= mainlandBounds.minLon &&
    centroidLon <= mainlandBounds.maxLon &&
    centroidLat >= mainlandBounds.minLat &&
    centroidLat <= mainlandBounds.maxLat
  );
}

// Filter a feature's geometry to only include mainland polygons
function filterFeatureGeometry(feature: GeoJSONFeature, countryName: string): GeoJSONFeature {
  if (countryName !== 'France') return feature;

  if (feature.geometry.type === 'Polygon') {
    // Single polygon - check if it's mainland
    const coords = feature.geometry.coordinates as number[][][];
    if (coords.length > 0 && isMainlandPolygon(countryName, coords[0])) {
      return feature;
    }
    // Return empty geometry if not mainland
    return {
      ...feature,
      geometry: { ...feature.geometry, coordinates: [] }
    };
  } else if (feature.geometry.type === 'MultiPolygon') {
    // Multiple polygons - filter to only mainland ones
    const coords = feature.geometry.coordinates as number[][][][];
    const filteredCoords = coords.filter(polygon => {
      if (polygon.length > 0) {
        return isMainlandPolygon(countryName, polygon[0]);
      }
      return false;
    });
    return {
      ...feature,
      geometry: { ...feature.geometry, coordinates: filteredCoords }
    };
  }

  return feature;
}

// Simple function to project coordinates (Mercator-like for display)
function projectCoordinate(lon: number, lat: number, lonOffset: number = 0): [number, number] {
  // Simple equirectangular projection scaled for SVG
  // lonOffset is used to shift coordinates for antimeridian-crossing polygons
  const adjustedLon = lon + lonOffset;
  const x = (adjustedLon + 180) * (800 / 360);
  const y = (90 - lat) * (400 / 180);
  return [x, y];
}

// Check if a ring crosses the antimeridian (has large longitude jumps)
function crossesAntimeridian(coords: number[][]): boolean {
  for (let i = 1; i < coords.length; i++) {
    const lonDiff = Math.abs(coords[i][0] - coords[i - 1][0]);
    if (lonDiff > 180) return true;
  }
  return false;
}

// Convert coordinates to SVG path, handling antimeridian crossing
function coordsToPath(coords: number[][]): string {
  if (!coords || coords.length === 0) return '';

  // Check if this ring crosses the antimeridian
  const crosses = crossesAntimeridian(coords);

  const points = coords.map(([lon, lat]) => {
    if (crosses && lon < 0) {
      // Shift negative longitudes to positive side (wrap around)
      return projectCoordinate(lon, lat, 360);
    }
    return projectCoordinate(lon, lat);
  });

  if (points.length === 0) return '';

  const [first, ...rest] = points;
  return `M${first[0]},${first[1]} ${rest.map(([x, y]) => `L${x},${y}`).join(' ')} Z`;
}

// Generate SVG path from geometry
function geometryToPath(geometry: GeoJSONFeature['geometry']): string {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as number[][][]).map(ring => coordsToPath(ring)).join(' ');
  } else if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][])
      .map(polygon => polygon.map(ring => coordsToPath(ring)).join(' '))
      .join(' ');
  }
  return '';
}

// Calculate bounding box for a set of countries
function calculateBounds(features: GeoJSONFeature[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  let hasAntimeridianCrossing = false;

  for (const feature of features) {
    const coords = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates as number[][][]]
      : (feature.geometry.coordinates as number[][][][]);

    for (const polygon of coords) {
      for (const ring of polygon) {
        if (crossesAntimeridian(ring)) {
          hasAntimeridianCrossing = true;
        }
        for (const [lon, lat] of ring) {
          // If we have antimeridian crossing, shift negative lons
          const adjustedLon = hasAntimeridianCrossing && lon < 0 ? lon + 360 : lon;
          minLon = Math.min(minLon, adjustedLon);
          maxLon = Math.max(maxLon, adjustedLon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }
  }

  const [minX, maxY] = projectCoordinate(minLon, minLat);
  const [maxX, minY] = projectCoordinate(maxLon, maxLat);

  return { minX, minY, maxX, maxY };
}

export function CountryMap({ targetCountry, guessedBorders, allBorders, gameOver, showOutlines = false, wrongGuesses = [] }: CountryMapProps) {
  const { t } = useTranslation();
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(2); // Initial zoom is 2x the target country

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.max(0.5, prev / 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.min(8, prev * 2));
  }, []);

  // Reset zoom when target country changes
  useEffect(() => {
    setZoomLevel(2);
  }, [targetCountry]);

  // Load GeoJSON data
  useEffect(() => {
    const controller = new AbortController();

    async function loadGeoData() {
      try {
        // Use Natural Earth 110m resolution for smaller file size
        const response = await fetch(
          'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error('Failed to load map data');

        const topoData = await response.json();

        // Convert TopoJSON to GeoJSON
        const { feature } = await import('topojson-client');
        const geoJSON = feature(topoData, topoData.objects.countries) as unknown as GeoJSONData;

        setGeoData(geoJSON);
        setLoading(false);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Could not load map');
          setLoading(false);
        }
      }
    }

    loadGeoData();
    return () => controller.abort();
  }, []);

  // Get the countries to display
  const countriesToShow = useMemo(() => {
    const countries = [targetCountry, ...guessedBorders, ...wrongGuesses];
    if (gameOver) {
      // Show all borders when game is over
      return [...new Set([targetCountry, ...allBorders])];
    }
    if (showOutlines) {
      // Show all borders when outline hint is used
      return [...new Set([targetCountry, ...allBorders, ...wrongGuesses])];
    }
    return [...new Set(countries)];
  }, [targetCountry, guessedBorders, allBorders, gameOver, showOutlines, wrongGuesses]);

  // Calculate viewBox based on target country bounds with zoom factor
  const viewBox = useMemo(() => {
    if (!geoData) return '0 0 800 400';

    // Find the target country feature
    const topoName = nameMapping[targetCountry] || targetCountry;
    const targetFeature = geoData.features.find(f => {
      const featureName = f.properties.name;
      if (!featureName) return false;
      return featureName === topoName || featureName.toLowerCase() === topoName.toLowerCase();
    });

    if (!targetFeature) {
      return '0 0 800 400';
    }

    const filteredFeature = filterFeatureGeometry(targetFeature, targetCountry);
    const bounds = calculateBounds([filteredFeature]);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Calculate center of target country
    const centerX = bounds.minX + width / 2;
    const centerY = bounds.minY + height / 2;

    // Apply zoom factor (2x means the viewBox is 2x the country size)
    const zoomedWidth = width * zoomLevel;
    const zoomedHeight = height * zoomLevel;

    // Add small padding
    const paddingX = zoomedWidth * 0.05;
    const paddingY = zoomedHeight * 0.05;

    const finalWidth = zoomedWidth + paddingX * 2;
    const finalHeight = zoomedHeight + paddingY * 2;

    return `${centerX - finalWidth / 2} ${centerY - finalHeight / 2} ${finalWidth} ${finalHeight}`;
  }, [geoData, targetCountry, zoomLevel]);

  // Get features for displayed countries (only the ones to show)
  const features = useMemo(() => {
    if (!geoData) return [];

    const countryFeatures: { feature: GeoJSONFeature; name: string; isTarget: boolean; isGuessed: boolean; isMissed: boolean; isOutlineHint: boolean; isWrong: boolean }[] = [];

    for (const name of countriesToShow) {
      // Map the game name to TopoJSON name if different
      const topoName = nameMapping[name] || name;

      // Find the feature by country name
      const feature = geoData.features.find(f => {
        const featureName = f.properties.name;
        if (!featureName) return false;
        return featureName === topoName || featureName.toLowerCase() === topoName.toLowerCase();
      });

      if (feature) {
        const filteredFeature = filterFeatureGeometry(feature, name);
        const isTarget = name === targetCountry;
        const isGuessed = guessedBorders.includes(name);
        const isMissed = gameOver && allBorders.includes(name) && !guessedBorders.includes(name) && !isTarget;
        const isOutlineHint = showOutlines && !gameOver && allBorders.includes(name) && !guessedBorders.includes(name) && !isTarget;
        const isWrong = !gameOver && wrongGuesses.includes(name);

        countryFeatures.push({ feature: filteredFeature, name, isTarget, isGuessed, isMissed, isOutlineHint, isWrong });
      }
    }

    return countryFeatures;
  }, [geoData, countriesToShow, targetCountry, guessedBorders, allBorders, gameOver, showOutlines, wrongGuesses]);

  if (loading) {
    return (
      <div className="country-map loading">
        <div className="map-loader">Loading map...</div>
      </div>
    );
  }

  if (error || features.length === 0) {
    return null; // Silently fail if map can't be loaded
  }

  return (
    <div className="country-map">
      <div className="zoom-controls">
        <button
          className="zoom-btn"
          onClick={handleZoomIn}
          disabled={zoomLevel <= 0.5}
          title={t('map.zoomIn')}
          aria-label={t('map.zoomIn')}
        >
          +
        </button>
        <button
          className="zoom-btn"
          onClick={handleZoomOut}
          disabled={zoomLevel >= 8}
          title={t('map.zoomOut')}
          aria-label={t('map.zoomOut')}
        >
          −
        </button>
      </div>
      <svg viewBox={viewBox} className="map-svg">
        {features.map(({ feature, name, isTarget, isGuessed, isMissed, isOutlineHint, isWrong }) => (
          <path
            key={name}
            d={geometryToPath(feature.geometry)}
            className={`country-path ${isTarget ? 'target' : ''} ${isGuessed ? 'guessed' : ''} ${isMissed ? 'missed' : ''} ${isOutlineHint ? 'outline-hint' : ''} ${isWrong ? 'wrong' : ''}`}
          />
        ))}
      </svg>
    </div>
  );
}
