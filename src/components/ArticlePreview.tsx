import React from 'react';
import { Clock, ArrowUpRight } from 'lucide-react';
import LazyImage from './LazyImage';

export interface ArticlePreviewProps {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  date: string;
  readTime: string;
  category: string;
}

const ArticlePreview: React.FC<ArticlePreviewProps> = ({
  id,
  title,
  excerpt,
  imageUrl,
  date,
  readTime,
  category
}) => {
  return (
    <article className="glass-strong rounded-3xl overflow-hidden hover:scale-[1.02] transition-all duration-500 group relative">
      {/* Animated background elements */}
      <div className="absolute -top-5 -right-5 w-20 h-20 bg-[#39ff14]/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
      
      <div className="relative h-48 overflow-hidden">
        <LazyImage 
          src={imageUrl} 
          alt={title} 
          className="w-full h-full transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        
        {/* Category badge - text only, green color */}
        <div className="absolute bottom-4 left-4">
          <span className="glass-neon rounded-full text-[#39ff14] text-xs font-semibold px-4 py-2 border border-[#39ff14]/40 bg-[#39ff14]/10 backdrop-blur-xl">
            {category}
          </span>
        </div>
      </div>
      
      <div className="p-6 relative z-10">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
          <time dateTime={date} className="flex items-center gap-1">
            <div className="w-1 h-1 bg-[#39ff14] rounded-full"></div>
            {date}
          </time>
          <span className="flex items-center glass rounded-lg px-2 py-1">
            <Clock className="w-3 h-3 ml-1" />
            {readTime} دقیقه مطالعه
          </span>
        </div>
        
        <h3 className="text-white font-bold text-lg mb-3 group-hover:text-[#39ff14] transition-colors duration-300 leading-tight">
          {title}
        </h3>
        
        <p className="text-gray-400 text-sm mb-6 line-clamp-2 leading-relaxed">
          {excerpt}
        </p>
        
        <div className="flex justify-end">
          <a 
            href={`/articles/${id}`}
            className="inline-flex items-center bg-gradient-to-r from-[#39ff14] to-[#00ff00] text-black rounded-xl py-2 px-4 font-medium hover:scale-105 transition-all duration-300 group/link relative overflow-hidden shadow-[0_0_15px_rgba(57,255,20,0.3)] hover:shadow-[0_0_25px_rgba(57,255,20,0.6)]"
          >
            {/* Button shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/link:translate-x-full transition-transform duration-700"></div>
            
            <span className="relative z-10">ادامه مطلب</span>
            <ArrowUpRight className="w-4 h-4 mr-2 group-hover/link:scale-110 transition-transform duration-300 relative z-10" />
          </a>
        </div>
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-[#39ff14]/40 rounded-full animate-float"
            style={{
              left: `${20 + (i * 20)}%`,
              top: `${30 + Math.sin(i) * 20}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + (i % 2)}s`
            }}
          />
        ))}
      </div>
    </article>
  );
};

export default ArticlePreview;