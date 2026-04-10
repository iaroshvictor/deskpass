import {useState, useEffect} from 'react'

export default function getWindowSize(){
    const hasWindow = typeof window !== 'undefined';
    function getWindowDimensions() {
        const width = hasWindow ? window.innerWidth : 100;
        const height = hasWindow ? window.innerHeight : 100;
        return {
        width,
        height,
        };
    }
    const [windowDimensions, setWindowDimensions] = useState<{width:number, height:number}>(getWindowDimensions());
    useEffect(() => {
        if (hasWindow) {
        function handleResize() {
            setWindowDimensions(getWindowDimensions());
        }

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
        }
    }, [hasWindow]);
  return windowDimensions
}