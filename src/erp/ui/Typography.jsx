import React from "react";

export const SectionTitle = ({ title, subtitle, icon: Icon }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      {subtitle ? <p className="text-xs text-gray-400">{subtitle}</p> : null}
    </div>
    {Icon ? <Icon className="w-5 h-5 text-blue-300" /> : null}
  </div>
);
