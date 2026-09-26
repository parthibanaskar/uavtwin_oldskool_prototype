import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, Wind, Droplets } from "lucide-react";

export function WeatherWidget({ lat, lon }: { lat: number; lon: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
        );
        const data = await res.json();
        setWeather(data);
      } catch (err) {
        console.error("Failed to fetch weather", err);
      }
    };
    
    fetchWeather();
    const interval = setInterval(fetchWeather, 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat.toFixed(2), lon.toFixed(2)]);

  if (!weather?.current) return null;

  const current = weather.current;
  const daily = weather.daily;

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="h-5 w-5 text-yellow-500" />;
    if (code <= 3) return <Cloud className="h-5 w-5 text-gray-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="h-5 w-5 text-blue-400" />;
    return <Cloud className="h-5 w-5 text-gray-400" />;
  };

  const getConditionText = (code: number) => {
    if (code === 0) return "Clear Sky";
    if (code === 1) return "Mainly Clear";
    if (code === 2) return "Partly Cloudy";
    if (code === 3) return "Overcast";
    if (code >= 51 && code <= 67) return "Rain";
    if (code >= 71) return "Snow";
    return "Cloudy";
  };

  return (
    <div className="panel-surface pointer-events-auto w-[16rem] p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="label-xs text-muted-foreground uppercase">LIVE WEATHER</p>
          <div className="flex items-center gap-2 mt-1">
            {getWeatherIcon(current.weather_code)}
            <p className="font-mono text-lg leading-none">{current.temperature_2m}°C</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{getConditionText(current.weather_code)}</p>
        </div>
        
        <div className="flex flex-col gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Wind className="w-3 h-3 text-muted-foreground"/> 
            <span>{current.wind_speed_10m} km/h</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="w-3 h-3 text-muted-foreground"/> 
            <span>{current.relative_humidity_2m}%</span>
          </div>
        </div>
      </div>

      {daily && (
        <div className="border-t border-white/10 pt-2">
          <p className="label-xs text-muted-foreground uppercase mb-2">NEXT 3 DAYS</p>
          <div className="flex justify-between gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center flex-1 bg-white/5 rounded p-1.5">
                <span className="text-[0.65rem] text-muted-foreground mb-1">
                  +{i * 24}h
                </span>
                {getWeatherIcon(daily.weather_code[i])}
                <span className="text-xs mt-1 font-mono">{daily.temperature_2m_max[i]}°</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
