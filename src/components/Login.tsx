import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, ShieldCheck, ArrowRight, Loader2, User as UserIcon, Check, X } from 'lucide-react';
import { api } from '../utils/api';
import './Login.css';

export const Login: React.FC<{ forceStep?: 'username' }> = ({ forceStep }) => {
  const { login, confirm, refreshUsername } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [step, setStep] = useState<'email' | 'otp' | 'username'>(forceStep || 'email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const validateEmail = (e: string) => {
    return String(e)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const success = await login(email);
      if (success) {
        setStep('otp');
      } else {
        setError('Failed to send OTP. Please check your email.');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const res = await confirm(email, otp);
      if (res.success) {
        if (!res.hasUsername) {
          setStep('username');
        }
      } else {
        setError('Invalid OTP. Please check your inbox.');
      }
    } catch (err) {
      setError('Verification failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameChange = async (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 15);
    setUsername(clean);
    setIsAvailable(null);
    if (clean.length >= 3) {
      setIsChecking(true);
      try {
        const { available } = await api.checkUsername(clean);
        setIsAvailable(available);
      } catch {
        setIsAvailable(false);
      }
      setIsChecking(false);
    }
  };

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAvailable || username.length < 3) return;
    setIsLoading(true);
    try {
      const { success } = await api.setUsername(username);
      if (success) {
        refreshUsername(username);
        // AuthContext will trigger re-render and Dashboard will show
      } else {
        setError('Failed to set username');
      }
    } catch (err) {
      setError('Could not set username');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="card glass login-card anime-fade-in">
        <div className="login-header">
           <div className="login-logo">
             {step === 'email' && <Mail size={32} />}
             {step === 'otp' && <ShieldCheck size={32} />}
             {step === 'username' && <UserIcon size={32} />}
           </div>
           <h1>
             {step === 'email' && 'Welcome'}
             {step === 'otp' && 'Verify OTP'}
             {step === 'username' && 'Choose Name'}
           </h1>
           <p>
             {step === 'email' && 'Enter your email to get started'}
             {step === 'otp' && `Enter the code sent to ${email}`}
             {step === 'username' && 'Enter a unique name for your profile'}
           </p>
        </div>

        <form 
          onSubmit={
            step === 'email' ? handleSendOtp : 
            step === 'otp' ? handleVerifyOtp : 
            handleSetUsername
          } 
          className="login-form"
        >
          {step === 'email' && (
            <div className="input-group">
              <input 
                type="email" 
                placeholder="Email Address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Mail size={18} className="input-icon" />
            </div>
          )}

          {step === 'otp' && (
            <div className="input-group">
              <input 
                type="text" 
                placeholder="6-Digit Code" 
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
              />
              <ShieldCheck size={18} className="input-icon" />
            </div>
          )}

          {step === 'username' && (
            <div className="input-group">
              <input 
                type="text" 
                placeholder="Unique Username" 
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                required
                autoFocus
                maxLength={15}
              />
              <div className="input-icon">
                {isChecking ? <Loader2 size={18} className="spinner-small" /> : <UserIcon size={18} />}
              </div>
              {isAvailable !== null && (
                <div className={`status-indicator ${isAvailable ? 'available' : 'taken'}`}>
                  {isAvailable ? <Check size={14} /> : <X size={14} />}
                </div>
              )}
            </div>
          )}

          {error && <div className="login-error">{error}</div>}
          {!error && step === 'username' && isAvailable === false && (
            <div className="login-error">This name is already taken</div>
          )}

          <button 
            type="submit" 
            className="btn primary-btn login-btn" 
            disabled={isLoading || (step === 'username' && !isAvailable)}
          >
            {isLoading ? <span><Loader2 className="spinner-small" size={18} /> Processing...</span> : (
              <>
                <span>
                  {step === 'email' && 'Get OTP'}
                  {step === 'otp' && 'Verify & Login'}
                  {step === 'username' && 'Start Tracking'}
                </span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {step === 'otp' && (
          <button className="back-link" onClick={() => setStep('email')} disabled={isLoading}>
            Change email address
          </button>
        )}

        <div className="login-footer">
          <p>Your data is protected and private.</p>
        </div>
      </div>
    </div>
  );
};
