import React, { useState, useEffect, useCallback, useRef } from "react";
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
  RefreshCw,
  Search,
  X,
  Navigation
} from "lucide-react";

interface CitySearchResult {
  id: number;
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
}

export const WeatherBanner: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<CitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Carregar cache inicial se existir para exibição instantânea
  useEffect(() => {
    try {
      const cached = localStorage.getItem("nj_weather_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.data && typeof parsed.data.temp === "number") {
          setWeather(parsed.data);
          // Se o cache tiver menos de 20 minutos, tira o loading imediato
          if (Date.now() - (parsed.timestamp || 0) < 20 * 60 * 1000) {
            setLoading(false);
          }
        }
      }
    } catch {
      // Ignorar erros de localStorage
    }
  }, []);

  // 2. Função universal para buscar previsão do tempo
  const fetchWeather = useCallback(async (lat?: number, lon?: number, preferredCity?: string, preferredState?: string) => {
    setLoading(true);
    try {
      // Montar URL para a API backend
      let url = "/api/weather";
      const params = new URLSearchParams();
      if (typeof lat === "number" && !isNaN(lat)) params.append("lat", lat.toString());
      if (typeof lon === "number" && !isNaN(lon)) params.append("lon", lon.toString());
      if (preferredCity && !preferredCity.toLowerCase().includes("localiza") && preferredCity !== "BR") {
        params.append("city", preferredCity);
      }
      if (preferredState && preferredState !== "BR") {
        params.append("state", preferredState);
      }

      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const w = json.data;
          setWeather(w);
          try {
            localStorage.setItem("nj_weather_cache", JSON.stringify({ data: w, timestamp: Date.now() }));
          } catch {}
          setLoading(false);
          return;
        }
      }

      // Fallback autônomo client-side (Open-Meteo direto) caso o backend não responda
      let targetLat = lat;
      let targetLon = lon;
      let targetCity = preferredCity;
      let targetState = preferredState;

      // Se não temos coordenadas nem cidade, tentar detecção direta via IP do cliente
      if ((targetLat === undefined || isNaN(targetLat)) && (!targetCity || targetCity.toLowerCase().includes("localiza"))) {
        try {
          const ipRes = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(3500) });
          if (ipRes.ok) {
            const ipData = await ipRes.json();
            if (ipData && ipData.success !== false && ipData.latitude && ipData.longitude) {
              targetLat = ipData.latitude;
              targetLon = ipData.longitude;
              if (ipData.city) targetCity = ipData.city;
              if (ipData.region_code) targetState = ipData.region_code;
            }
          }
        } catch {}
      }

      // Se temos coordenadas e a cidade ainda for genérica, tentar geocodificação reversa direta do navegador
      if (typeof targetLat === "number" && typeof targetLon === "number" && (!targetCity || targetCity.toLowerCase().includes("localiza"))) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${targetLat}&lon=${targetLon}&format=json&addressdetails=1&zoom=14`,
            {
              headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
              signal: AbortSignal.timeout(3500)
            }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const addr = geoData.address || {};
            const found = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.district || addr.suburb || addr.hamlet || addr.county;
            if (found) targetCity = found;
            if (addr["ISO3166-2-lvl4"]) targetState = addr["ISO3166-2-lvl4"].replace("BR-", "");
          }
        } catch {}
      }

      const finalLat = targetLat ?? -15.7975;
      const finalLon = targetLon ?? -47.8919;
      const finalCity = targetCity || "Sua Região";
      const finalState = targetState || "PR";

      const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${finalLat}&longitude=${finalLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
      const omRes = await fetch(openMeteoUrl, { signal: AbortSignal.timeout(4000) });
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

      const fallbackWeather: WeatherData = {
        city: finalCity,
        state: finalState,
        temp: Math.round(cur.temperature_2m ?? 24),
        apparentTemp: Math.round(cur.apparent_temperature ?? 25),
        humidity: cur.relative_humidity_2m ?? 60,
        windSpeed: Math.round(cur.wind_speed_10m ?? 12),
        weatherCode: code,
        conditionText: cond,
        isDay: cur.is_day === 1,
        tempMax: Math.round(daily.temperature_2m_max?.[0] ?? 28),
        tempMin: Math.round(daily.temperature_2m_min?.[0] ?? 18),
        precipitation: cur.precipitation ?? 0,
        updatedAt: new Date().toISOString(),
      };

      setWeather(fallbackWeather);
      try {
        localStorage.setItem("nj_weather_cache", JSON.stringify({ data: fallbackWeather, timestamp: Date.now() }));
      } catch {}
    } catch (err) {
      console.warn("Aviso ao obter dados meteorológicos:", err);
    } finally {
      setLoading(false);
      setIsLocating(false);
    }
  }, []);

  // 3. Detecção por IP direto do cliente caso o GPS não esteja acessível
  const detectCityByClientIp = useCallback(async () => {
    setIsLocating(true);
    let ipLat: number | undefined;
    let ipLon: number | undefined;
    let ipCity: string | undefined;
    let ipState: string | undefined;

    try {
      const res = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const d = await res.json();
        if (d && d.success !== false && d.city && d.latitude && d.longitude) {
          ipCity = d.city;
          ipState = d.region_code || d.region;
          ipLat = d.latitude;
          ipLon = d.longitude;
        }
      }
    } catch {}

    if (!ipCity) {
      try {
        const res = await fetch("https://freeipapi.com/api/json", { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const d = await res.json();
          if (d && d.cityName && d.latitude && d.longitude) {
            ipCity = d.cityName;
            ipState = d.regionName;
            ipLat = d.latitude;
            ipLon = d.longitude;
          }
        }
      } catch {}
    }

    await fetchWeather(ipLat, ipLon, ipCity, ipState);
    setIsLocating(false);
  }, [fetchWeather]);

  // 4. Detecção precisa de localização do usuário (GPS de alta precisão com fallback para IP)
  const detectLocalCity = useCallback((forceGps = false) => {
    setIsLocating(true);

    // Se o usuário já escolheu manualmente uma cidade e não solicitou forçar GPS, honrar a escolha
    if (!forceGps) {
      try {
        const saved = localStorage.getItem("nj_selected_city");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.name && typeof parsed?.lat === "number" && typeof parsed?.lon === "number") {
            fetchWeather(parsed.lat, parsed.lon, parsed.name, parsed.state);
            return;
          }
        }
      } catch {}
    } else {
      try {
        localStorage.removeItem("nj_selected_city");
      } catch {}
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          let clientCity = "";
          let clientState = "";

          // Tentar geocodificar o nome exato do município no cliente
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=14`,
              {
                headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
                signal: AbortSignal.timeout(3000)
              }
            );
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              const addr = geoData.address || {};
              const found = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || addr.district || addr.suburb || addr.hamlet || addr.county;
              if (found) {
                clientCity = found;
                clientState = addr["ISO3166-2-lvl4"]?.replace("BR-", "") || addr.state || "";
              }
            }
          } catch {
            // Se falhar no browser, o backend resolverá pelo endpoint /api/weather
          }

          await fetchWeather(lat, lon, clientCity, clientState);
          setIsLocating(false);
        },
        async () => {
          // Se a geolocalização do navegador for negada ou sofrer timeout, detectar pelo IP do cliente
          await detectCityByClientIp();
        },
        { timeout: 7000, enableHighAccuracy: true, maximumAge: 30000 }
      );
    } else {
      detectCityByClientIp();
    }
  }, [fetchWeather, detectCityByClientIp]);

  // Disparar detecção ao montar o componente
  useEffect(() => {
    detectLocalCity();
  }, [detectLocalCity]);

  // 4. Busca de Cidades
  const handleSearchCities = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Primeiro tentar rota do backend
      const res = await fetch(`/api/weather/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.results) && json.results.length > 0) {
          setSearchResults(json.results);
          setIsSearching(false);
          return;
        }
      }

      // Fallback client-side para Open-Meteo Geocoding
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=pt&format=json`;
      const omRes = await fetch(geoUrl);
      if (omRes.ok) {
        const omData = await omRes.json();
        const results = (omData.results || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          state: r.admin1 || "",
          country: r.country_code || "BR",
          latitude: r.latitude,
          longitude: r.longitude,
        }));
        setSearchResults(results);
      }
    } catch (e) {
      console.warn("Erro ao buscar cidades:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCity = (cityItem: CitySearchResult) => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    try {
      localStorage.setItem("nj_selected_city", JSON.stringify({
        name: cityItem.name,
        state: cityItem.state,
        lat: cityItem.latitude,
        lon: cityItem.longitude
      }));
    } catch {}
    fetchWeather(cityItem.latitude, cityItem.longitude, cityItem.name, cityItem.state);
  };

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
          <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="truncate max-w-[170px] sm:max-w-[210px]">
            {weather ? `Tempo em ${weather.city}` : "Previsão do Tempo"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              if (!showSearch) {
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }
            }}
            title="Trocar ou pesquisar cidade"
            className={`p-1 px-2 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer ${
              showSearch
                ? "bg-blue-600 text-white"
                : "text-blue-300 hover:text-white hover:bg-blue-900/60"
            }`}
          >
            <Search className="w-3 h-3" />
            <span className="text-[11px] hidden sm:inline">Cidade</span>
          </button>

          <button
            onClick={detectLocalCity}
            disabled={isLocating || loading}
            title="Detectar minha localização atual"
            className="p-1 px-2 rounded text-blue-300 hover:text-white hover:bg-blue-900/60 transition-colors disabled:opacity-40 flex items-center gap-1 text-[11px] cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLocating ? "animate-spin text-amber-400" : ""}`} />
            <span className="text-[11px] hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* Caixa de Pesquisa de Cidade Integrada */}
      {showSearch && (
        <div className="mb-3 bg-slate-950/85 border border-blue-800/60 rounded-lg p-2.5 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchCities(e.target.value)}
                placeholder="Ex: Ponta Grossa, Curitiba, São Paulo..."
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Fechar pesquisa"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mb-1">
            <span>Resultados:</span>
            <button
              onClick={() => {
                setShowSearch(false);
                detectLocalCity(true);
              }}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer text-[10px]"
            >
              <Navigation className="w-2.5 h-2.5" />
              Usar GPS Atual
            </button>
          </div>

          {isSearching && (
            <div className="text-center py-2 text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
              <span>Buscando cidades...</span>
            </div>
          )}

          {searchResults.length > 0 && (
            <ul className="divide-y divide-slate-800/80 max-h-36 overflow-y-auto rounded bg-slate-900/90 border border-slate-800 text-xs">
              {searchResults.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleSelectCity(item)}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-blue-900/50 text-slate-200 hover:text-white transition-colors flex items-center justify-between"
                  >
                    <span className="font-medium text-white">{item.name}</span>
                    <span className="text-[10px] text-blue-300">
                      {item.state ? `${item.state}, ` : ""}{item.country}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
            <div className="text-center py-2 text-xs text-slate-400">
              Nenhuma cidade encontrada para &quot;{searchQuery}&quot;.
            </div>
          )}
        </div>
      )}

      {/* Weather Content */}
      {loading && !weather ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-xs">Obtendo previsão do tempo para sua cidade...</span>
        </div>
      ) : weather ? (
        <div>
          {/* Main Info */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-3xl font-bold tracking-tight text-white">{weather.temp}°C</span>
                <button
                  onClick={() => {
                    setShowSearch(true);
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }}
                  title="Clique para pesquisar ou alterar a cidade"
                  className="group flex items-center gap-1 text-xs text-blue-300 hover:text-white font-semibold cursor-pointer transition-colors max-w-[170px] text-left"
                >
                  <span className="truncate">{weather.city}{weather.state ? ` - ${weather.state}` : ""}</span>
                  <span className="text-[10px] text-blue-400 group-hover:text-amber-300 group-hover:underline opacity-80">(trocar)</span>
                </button>
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
              {new Date(weather.updatedAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
