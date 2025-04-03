import React from 'react';
import { DisplayGroup } from '../../types/display';
import { useDisplays } from '../../hooks/useDisplays';
import './GroupStats.css';

interface GroupStatsProps {
  groups: DisplayGroup[];
}

export const GroupStats: React.FC<GroupStatsProps> = ({ groups }) => {
  const { displays } = useDisplays();

  const totalDisplays = displays.length;
  const totalGroups = groups.length;
  const displaysInGroups = groups.reduce(
    (acc, group) => acc + group.displayIds.length,
    0
  );
  const unassignedDisplays = totalDisplays - displaysInGroups;

  const averageDisplaysPerGroup = totalGroups > 0
    ? (displaysInGroups / totalGroups).toFixed(1)
    : '0';

  const groupHealth = groups.map(group => {
    const groupDisplays = displays.filter(d => group.displayIds.includes(d.id));
    const healthyDisplays = groupDisplays.filter(d => d.health?.status === 'healthy').length;
    const healthPercentage = groupDisplays.length > 0
      ? (healthyDisplays / groupDisplays.length) * 100
      : 0;

    return {
      groupName: group.name,
      healthPercentage,
      totalDisplays: groupDisplays.length,
      healthyDisplays,
    };
  });

  return (
    <div className="group-stats">
      <h2>Group Statistics</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Groups</h3>
          <p className="stat-value">{totalGroups}</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Displays</h3>
          <p className="stat-value">{totalDisplays}</p>
        </div>
        
        <div className="stat-card">
          <h3>Displays in Groups</h3>
          <p className="stat-value">{displaysInGroups}</p>
        </div>
        
        <div className="stat-card">
          <h3>Unassigned Displays</h3>
          <p className="stat-value">{unassignedDisplays}</p>
        </div>
        
        <div className="stat-card">
          <h3>Avg. Displays/Group</h3>
          <p className="stat-value">{averageDisplaysPerGroup}</p>
        </div>
      </div>

      <div className="group-health-section">
        <h3>Group Health Overview</h3>
        <div className="group-health-list">
          {groupHealth.map(({ groupName, healthPercentage, totalDisplays, healthyDisplays }) => (
            <div key={groupName} className="group-health-item">
              <div className="group-health-header">
                <span className="group-name">{groupName}</span>
                <span className="health-percentage">
                  {healthPercentage.toFixed(1)}% Healthy
                </span>
              </div>
              <div className="health-bar">
                <div
                  className="health-bar-fill"
                  style={{ width: `${healthPercentage}%` }}
                />
              </div>
              <div className="health-details">
                <span>{healthyDisplays} of {totalDisplays} displays healthy</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 