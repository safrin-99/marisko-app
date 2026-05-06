import { create } from 'zustand'

export const useAppStore = create((set) => ({
  activeMenu: 'BASTK', // Menu awal yang terbuka
  setActiveMenu: (menu) => set({ activeMenu: menu }),
  
  isSidebarOpen: false, // Untuk tampilan di HP
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}))