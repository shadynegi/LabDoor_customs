import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Loader from "./Loader";

interface RouteLoaderProps {
  children: React.ReactNode;
}

export default function RouteLoader({ children }: RouteLoaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Show loader on route change
    setIsLoading(true);
    
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // Show loader for 0.8 seconds on route change

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <>
      <Loader isLoading={isLoading} />
      {children}
    </>
  );
}

