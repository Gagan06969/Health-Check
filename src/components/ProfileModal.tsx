import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ProfileModalProps {
  user: any;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    weight: user?.weight || 70,
    targetWeight: user?.targetWeight || 65,
    height: user?.height || 175,
    age: user?.age || 25,
    gender: user?.gender || 'Male',
    dietPreference: user?.dietPreference || 'Both',
    stepGoal: user?.stepGoal || 10000
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Update Profile & Goals</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="dashboard-grid" style={{ gap: '16px' }}>
            <div className="input-group">
              <label>Current Weight (kg)</label>
              <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} className="glass-input" required />
            </div>
            <div className="input-group">
              <label>Target Weight (kg)</label>
              <input type="number" step="0.1" name="targetWeight" value={formData.targetWeight} onChange={handleChange} className="glass-input" required />
            </div>
            <div className="input-group">
              <label>Height (cm)</label>
              <input type="number" step="0.1" name="height" value={formData.height} onChange={handleChange} className="glass-input" required />
            </div>
            <div className="input-group">
              <label>Age</label>
              <input type="number" name="age" value={formData.age} onChange={handleChange} className="glass-input" required />
            </div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label>Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="glass-input">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            
            <div className="input-group">
              <label>Dietary Preference</label>
              <select name="dietPreference" value={formData.dietPreference} onChange={handleChange} className="glass-input">
                <option value="Both">Both</option>
                <option value="Veg">Vegetarian</option>
                <option value="Non-Veg">Non-Vegetarian</option>
              </select>
            </div>
            
            <div className="input-group">
              <label>Daily Step Goal</label>
              <input type="number" name="stepGoal" value={formData.stepGoal} onChange={handleChange} className="glass-input" required />
            </div>
          </div>
          
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '24px', justifyContent: 'center' }}>
            Save Goals
          </button>
        </form>
      </div>
    </div>
  );
};
