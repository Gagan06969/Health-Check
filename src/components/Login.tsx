import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import './Login.css';

export const Login: React.FC = () => {
  const { login, confirm } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      if (!res.success) {
        setError('Invalid OTP. Please check your inbox.');
      }
    } catch (err) {
      setError('Verification failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="card glass login-card anime-fade-in">
        <div className="login-header">
           <div className="login-logo">
             {step === 'email' ? <Mail size={32} /> : <ShieldCheck size={32} />}
           </div>
           <h1>{step === 'email' ? 'Welcome' : 'Verify OTP'}</h1>
           <p>
             {step === 'email' 
              ? 'Enter your email to get started' 
              : `Enter the code sent to ${email}`}
           </p>
        </div>

        <form onSubmit={step === 'email' ? handleSendOtp : handleVerifyOtp} className="login-form">
          {step === 'email' ? (
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
          ) : (
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

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn primary-btn login-btn" disabled={isLoading}>
            {isLoading ? <span><Loader2 className="spinner-small" size={18} /> Processing...</span> : (
              <>
                <span>{step === 'email' ? 'Get OTP' : 'Verify & Login'}</span>
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
          <p>Your email is secured with SHA-256 hashing.</p>
        </div>
      </div>
    </div>
  );
};
