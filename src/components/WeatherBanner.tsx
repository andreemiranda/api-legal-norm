import React, { useState, useEffect, useCallback } from "react";
import { WeatherData } from "../types";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
  Wind,
  Droplets,
  MapPin,
  RefreshCw
} from "lucide-react";

export const WeatherBanner: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const fetchWeather = useCallback(async (lat: number, lon: number, cityName: string, stateName: string) => {
    setLoading(true);
    try {
      // First try local backend endpoint
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}&city=${encodeURIComponent(cityName)}&state=${encodeURIComponent(stateName)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setWeather(json.data);
          setLoading(false);
          return;
        }
      }

      // Direct fallback to Open-Meteo public API
      const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
      const omRes = await fetch(openMeteoUrl);
      const omData = await omRes.json();
      const cur = omData.current || {};
      const daily = omData.daily || {};
      const code = cur.weather_code ?? 0;

      let cond = "Ensolarado";
      if (code === 0) cond = cur.is_day ? "Céu limpo" : "Noite estrelada";
      else if (code >= 1 && code <= 3) cond = "Parcialmente nublado";
      else if (code >= 45 && code <= 48) cond = "Nevoeiro";
      else if (code >= 51 && code <= 67) cond = "Chuva leve";
      else if (code >= 71 && code <= 77) cond = "Neve";
      else if (code >= 80 && code <= 82) cond = "Pancadas de chuva";
      else if (code >= 95) cond = "Tempestade";

      setWeather({
        city: cityName,
        state: stateName,
        temp: Math.round(cur.temperature_2m ?? 25),
        apparentTemp: Math.round(cur.apparent_temperature ?? 26),
        humidity: cur.relative_humidity_2m ?? 65,
        windSpeed: Math.round(cur.wind_speed_10m ?? 12),
        weatherCode: code,
        conditionText: cond,
        isDay: cur.is_day === 1,
        tempMax: Math.round(daily.temperature_2m_max?.[0] ?? 28),
        tempMin: Math.round(daily.temperature_2m_min?.[0] ?? 19),
        precipitation: cur.precipitation ?? 0,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to load weather:", err);
      // Fallback default
      setWeather({
        city: cityName || "Brasília",
        state: stateName || "DF",
        temp: 26,
        apparentTemp: 27,
        humidity: 60,
        windSpeed: 14,
        weatherCode: 1,
        conditionText: "Ensolarado",
        isDay: true,
        tempMax: 29,
        tempMin: 18,
        precipitation: 0,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Detect user local location
  const detectLocalCity = useCallback(() => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          try {
            // Reverse geocode with Open-Meteo or bigdatacloud free reverse geocoding
            const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`);
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              const detectedCity = geoData.city || geoData.locality || "Sua Cidade";
              const detectedState = geoData.principalSubdivisionCode?.replace("BR-", "") || "BR";
              await fetchWeather(lat, lon, detectedCity, detectedState);
              setIsLocating(false);
              return;
            }
          } catch {
            // fallback
          }
          await fetchWeather(lat, lon, "Localização Atual", "BR");
          setIsLocating(false);
        },
        async () => {
          // Geolocation denied or unavailable; try IP Geolocation
          try {
            const ipRes = await fetch("https://ipapi.co/json/");
            if (ipRes.ok) {
              const ipData = await ipRes.json();
              if (ipData.latitude && ipData.longitude) {
                await fetchWeather(ipData.latitude, ipData.longitude, ipData.city || "Brasília", ipData.region_code || "DF");
                setIsLocating(false);
                return;
              }
            }
          } catch {
            // ignore
          }
          // Default to Brasília
          await fetchWeather(-15.7975, -47.8919, "Brasília", "DF");
          setIsLocating(false);
        },
        { timeout: 8000 }
      );
    } else {
      fetchWeather(-15.7975, -47.8919, "Brasília", "DF");
      setIsLocating(false);
    }
  }, [fetchWeather]);

  useEffect(() => {
    detectLocalCity();
  }, [detectLocalCity]);

  const renderWeatherIcon = (code: number, isDay: boolean) => {
    if (code === 0) return isDay ? <Sun className="w-8 h-8 text-amber-400 animate-spin-slow" /> : <Sun className="w-8 h-8 text-blue-300" />;
    if (code >= 1 && code <= 3) return <CloudSun className="w-8 h-8 text-amber-300" />;
    if (code >= 45 && code <= 48) return <CloudFog className="w-8 h-8 text-slate-300" />;
    if (code >= 51 && code <= 67) return <CloudRain className="w-8 h-8 text-blue-400" />;
    if (code >= 71 && code <= 77) return <CloudSnow className="w-8 h-8 text-blue-200" />;
    if (code >= 80 && code <= 82) return <CloudRain className="w-8 h-8 text-cyan-400" />;
    if (code >= 95) return <CloudLightning className="w-8 h-8 text-amber-300" />;
    return <Cloud className="w-8 h-8 text-slate-300" />;
  };

  return (
    <div
      id="weather-banner"
      className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-blue-800/50 rounded-xl p-4 text-slate-100 shadow-lg relative overflow-hidden"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-blue-800/40 pb-2.5 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-blue-300 font-semibold uppercase tracking-wider">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span>{weather ? `Tempo em ${weather.city}` : "Tempo Local"}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={detectLocalCity}
            disabled={isLocating || loading}
            title="Atualizar clima local"
            className="p-1 px-1.5 rounded text-blue-300 hover:text-white hover:bg-blue-900/60 transition-colors disabled:opacity-40 flex items-center gap-1 text-[11px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLocating || loading ? "animate-spin" : ""}`} />
            <span className="text-[10px]">Atualizar</span>
          </button>
        </div>
      </div>

      {/* Weather Content */}
      {loading ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-xs">Identificando clima local...</span>
        </div>
      ) : weather ? (
        <div>
          {/* Main Info */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-white">{weather.temp}°C</span>
                <span className="text-xs text-blue-300 font-medium">
                  {weather.city}
                  {weather.state ? ` - ${weather.state}` : ""}
                </span>
              </div>
              <p className="text-xs text-slate-300 capitalize mt-0.5 font-medium">{weather.conditionText}</p>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-950/70 border border-blue-800/40 shadow-inner">
              {renderWeatherIcon(weather.weatherCode, weather.isDay)}
            </div>
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950/60 rounded-lg p-2 border border-blue-900/40 text-[11px] text-slate-300">
            <div className="flex flex-col items-center">
              <span className="text-slate-400 text-[10px]">Sensação</span>
              <span className="font-semibold text-white">{weather.apparentTemp}°C</span>
            </div>
            <div className="flex flex-col items-center border-x border-slate-800">
              <span className="text-slate-400 text-[10px] flex items-center gap-0.5">
                <Droplets className="w-2.5 h-2.5 text-cyan-400" /> Umidade
              </span>
              <span className="font-semibold text-white">{weather.humidity}%</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-slate-400 text-[10px] flex items-center gap-0.5">
                <Wind className="w-2.5 h-2.5 text-blue-400" /> Vento
              </span>
              <span className="font-semibold text-white">{weather.windSpeed} km/h</span>
            </div>
          </div>

          {/* Max/Min bar */}
          <div className="mt-2.5 pt-2 border-t border-blue-900/40 flex items-center justify-between text-[11px] text-slate-400">
            <div>
              <span>Mín: </span>
              <span className="text-blue-300 font-semibold">{weather.tempMin}°C</span>
              <span className="mx-1.5">•</span>
              <span>Máx: </span>
              <span className="text-amber-300 font-semibold">{weather.tempMax}°C</span>
            </div>
            <span className="text-[10px] text-blue-300/80">
              {new Date(weather.updatedAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).replace(" ", " às ")}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
