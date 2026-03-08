import React from "react";

export const AuditoriaPanel = ({ auditLog = [] }) => {
  return (
    <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
      {auditLog.length === 0 && (
        <p className="text-sm text-gray-400 py-2">Sem eventos registrados</p>
      )}
      {auditLog.map((log) => (
        <div key={log.id} className="py-2 text-xs text-gray-200">
          <span className="text-[11px] text-gray-400">
            {log.at?.slice(0, 19)?.replace("T", " ")}
          </span>{" "}
          <span className="font-semibold text-white">{log.action}</span>
        </div>
      ))}
    </div>
  );
};
