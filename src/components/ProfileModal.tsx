import { useState } from 'react';
import { X, User, Target, Ruler, Calendar, Venus, ChevronRight, Activity } from 'lucide-react';
import type { User as UserType } from '../types';
import './ProfileModal.css';

interface ProfileModalProps {
  user: UserType;
  onClose: () => void;
  onSave: (data: Partial<UserType>) => void;
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
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: name === 'gender' || name === 'dietPreference' ? value : Number(value) 
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Partial<UserType>);
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="glass profile-modal-content" onClick={e => e.stopPropagation()}>
        <div className="profile-header">
          <div className="profile-title-container">
            <h2>
              <div className="profile-icon-box">
                <User size={20} color="white" />
              </div>
              Profile Settings
            </h2>
            <p className="text-muted text-sm mt-1">Adjust your goals and physical metrics.</p>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">
                <Target size={14} /> Current Weight
              </label>
              <div className="input-wrapper">
                <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} className="input-field" required />
                <span className="input-unit">kg</span>
              </div>
            </div>
            
            <div className="input-group">
              <label className="input-label">
                <ChevronRight size={14} /> Target Weight
              </label>
              <div className="input-wrapper">
                <input type="number" step="0.1" name="targetWeight" value={formData.targetWeight} onChange={handleChange} className="input-field" required />
                <span className="input-unit">kg</span>
              </div>
            </div>
            
            <div className="input-group">
              <label className="input-label">
                <Ruler size={14} /> Height
              </label>
              <div className="input-wrapper">
                <input type="number" step="0.1" name="height" value={formData.height} onChange={handleChange} className="input-field" required />
                <span className="input-unit">cm</span>
              </div>
            </div>
            
            <div className="input-group">
              <label className="input-label">
                <Calendar size={14} /> Age
              </label>
              <div className="input-wrapper">
                <input type="number" name="age" value={formData.age} onChange={handleChange} className="input-field" required />
                <span className="input-unit">years</span>
              </div>
            </div>
          </div>
          
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">
                <Venus size={14} /> Gender
              </label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="input-field">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            
            <div className="input-group">
              <label className="input-label">Dietary Preference</label>
              <select name="dietPreference" value={formData.dietPreference} onChange={handleChange} className="input-field">
                <option value="Both">Both</option>
                <option value="Veg">Vegetarian</option>
                <option value="Non-Veg">Non-Vegetarian</option>
              </select>
            </div>
          </div>
          
          <div className="input-group">
            <label className="input-label">
              <Activity size={14} /> Daily Step Goal
            </label>
            <div className="input-wrapper">
              <input type="number" name="stepGoal" value={formData.stepGoal} onChange={handleChange} className="input-field" required />
              <span className="input-unit">steps</span>
            </div>
          </div>
          
          <div className="divider"></div>
          
          <button type="submit" className="save-btn">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};
