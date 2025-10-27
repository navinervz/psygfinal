import React from 'react';
import { UserCircle } from 'lucide-react';

interface Props {
  onClick: () => void;
}

const DashboardBubble: React.FC<Props> = ({ onClick }) => {
  return (
    <div 
      className="fixed bottom-6 right-6 w-[60px] h-[60px] bg-black/50 border-2 border-[#39ff14] rounded-full flex items-center justify-center cursor-pointer font-bold shadow-[0_0_15px_#39ff14] z-50 transition-transform hover:scale-110 animate-float-slow"
      onClick={onClick}
    >
      <UserCircle className="w-6 h-6 text-[#39ff14]" />
      
      <div className="absolute w-full h-full bg-[#39ff14]/30 rounded-full animate-pulse-slow"></div>
      
      <div className="small-bubble-container absolute w-full h-full overflow-visible">
        {[...Array(2)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-2 h-2 bg-[#39ff14] rounded-full opacity-80 animate-float-up"
            style={{
              left: `${20 + Math.random() * 60}%`,
              top: `${80 + Math.random() * 20}%`,
              animationDelay: `${i * 0.4}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default DashboardBubble;