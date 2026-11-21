import React from 'react';
import { SiteHeader } from './components/layout/SiteHeader';
import { Hero } from './components/sections/Hero';
import { Marquee } from './components/ui/Marquee';
import { Studio } from './components/studio/Studio';
import { HowItWorks } from './components/sections/HowItWorks';
import { Physics } from './components/sections/Physics';
import { SiteFooter } from './components/layout/SiteFooter';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#07080D] text-[#FFFFFF] flex flex-col font-body selection:bg-[#9947B7] selection:text-white relative overflow-x-hidden">
      {/* Dynamic Ambient Background Glows & Studio Grid */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {/* Top-left Violet / Magenta Aura */}
        <div className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[750px] max-h-[750px] rounded-full bg-gradient-to-br from-[#9947B7]/25 via-[#FF5598]/15 to-transparent blur-[120px] mix-blend-screen opacity-70" />
        
        {/* Top-right Sapphire / Electric Cyan Aura */}
        <div className="absolute top-[5%] -right-[15%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-bl from-[#007AD8]/25 via-[#00F0FF]/15 to-transparent blur-[130px] mix-blend-screen opacity-65" />
        
        {/* Mid-screen Sunset Magma Aura */}
        <div className="absolute top-[45%] -left-[15%] w-[45vw] h-[45vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-tr from-[#FE2902]/15 via-[#FF5598]/20 to-transparent blur-[140px] mix-blend-screen opacity-50" />
        
        {/* Bottom Emerald / Azure Accent Aura */}
        <div className="absolute bottom-[5%] -right-[10%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-tl from-[#9947B7]/20 via-[#007AD8]/20 to-transparent blur-[130px] mix-blend-screen opacity-60" />

        {/* Subtle Fine Studio Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_95%)]" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteHeader />
        <main className="flex-1 flex flex-col">
          <Hero />
          <Marquee />
          <Studio />
          <HowItWorks />
          <Physics />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
};

export default App;