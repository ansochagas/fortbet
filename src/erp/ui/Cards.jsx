import React from "react";

export const StatCard = ({ label, value, helper, icon }) => (
  <div className="bg-gray-900/70 border border-white/5 rounded-2xl p-5 shadow-lg">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm text-gray-400">{label}</span>
      {icon}
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
    {helper ? <p className="text-xs text-gray-300 mt-1">{helper}</p> : null}
  </div>
);

export const Pill = ({ children }) => (
  <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-gray-200">
    {children}
  </span>
);
