// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return void 0;
          if (id.includes("@metamask")) {
            return "metamask";
          }
          if (id.includes("@reown")) {
            return "appkit";
          }
          if (id.includes("@walletconnect")) {
            return "walletconnect";
          }
          if (id.includes("wagmi") || id.includes("viem") || id.includes("ethers")) {
            return "web3-core";
          }
          if (id.includes("react-router-dom")) {
            return "router";
          }
          if (id.includes("lucide-react")) {
            return "ui";
          }
          if (id.includes("zod")) {
            return "utils";
          }
          if (id.includes("react")) {
            return "vendor";
          }
          return void 0;
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  server: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer-when-downgrade"
    },
    proxy: {
      "/api/payment": {
        target: "http://127.0.0.1:9000",
        // اگر PHP را روی 9001 آوردی، اینجا هم 9001 کن
        changeOrigin: true
      },
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxuICAgIHNvdXJjZW1hcDogZmFsc2UsXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDI0LFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcbiAgICAgICAgICBpZiAoIWlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnQG1ldGFtYXNrJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnbWV0YW1hc2snO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnQHJlb3duJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnYXBwa2l0JztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0B3YWxsZXRjb25uZWN0JykpIHtcbiAgICAgICAgICAgIHJldHVybiAnd2FsbGV0Y29ubmVjdCc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCd3YWdtaScpIHx8IGlkLmluY2x1ZGVzKCd2aWVtJykgfHwgaWQuaW5jbHVkZXMoJ2V0aGVycycpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3dlYjMtY29yZSc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdyZWFjdC1yb3V0ZXItZG9tJykpIHtcbiAgICAgICAgICAgIHJldHVybiAncm91dGVyJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2x1Y2lkZS1yZWFjdCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3VpJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3pvZCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3V0aWxzJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3JlYWN0JykpIHtcbiAgICAgICAgICAgIHJldHVybiAndmVuZG9yJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBleGNsdWRlOiBbJ2x1Y2lkZS1yZWFjdCddLFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBoZWFkZXJzOiB7XG4gICAgICAnWC1Db250ZW50LVR5cGUtT3B0aW9ucyc6ICdub3NuaWZmJyxcbiAgICAgICdYLUZyYW1lLU9wdGlvbnMnOiAnREVOWScsXG4gICAgICAnUmVmZXJyZXItUG9saWN5JzogJ25vLXJlZmVycmVyLXdoZW4tZG93bmdyYWRlJ1xuICAgIH0sXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpL3BheW1lbnQnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6OTAwMCcsIC8vIFx1MDYyN1x1MDZBRlx1MDYzMSBQSFAgXHUwNjMxXHUwNjI3IFx1MDYzMVx1MDY0OFx1MDZDQyA5MDAxIFx1MDYyMlx1MDY0OFx1MDYzMVx1MDYyRlx1MDZDQ1x1MDYwQyBcdTA2MjdcdTA2Q0NcdTA2NDZcdTA2MkNcdTA2MjcgXHUwNjQ3XHUwNjQ1IDkwMDEgXHUwNkE5XHUwNjQ2XG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZVxuICAgICAgfSxcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjMwMDAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWVcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsV0FBVztBQUFBLElBQ1gsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxDQUFDLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUV6QyxjQUFJLEdBQUcsU0FBUyxXQUFXLEdBQUc7QUFDNUIsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMsUUFBUSxHQUFHO0FBQ3pCLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLGdCQUFnQixHQUFHO0FBQ2pDLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLE9BQU8sS0FBSyxHQUFHLFNBQVMsTUFBTSxLQUFLLEdBQUcsU0FBUyxRQUFRLEdBQUc7QUFDeEUsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMsa0JBQWtCLEdBQUc7QUFDbkMsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLEtBQUssR0FBRztBQUN0QixtQkFBTztBQUFBLFVBQ1Q7QUFFQSxjQUFJLEdBQUcsU0FBUyxPQUFPLEdBQUc7QUFDeEIsbUJBQU87QUFBQSxVQUNUO0FBRUEsaUJBQU87QUFBQSxRQUNUO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixTQUFTO0FBQUEsTUFDUCwwQkFBMEI7QUFBQSxNQUMxQixtQkFBbUI7QUFBQSxNQUNuQixtQkFBbUI7QUFBQSxJQUNyQjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsZ0JBQWdCO0FBQUEsUUFDZCxRQUFRO0FBQUE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLE1BQ2hCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
