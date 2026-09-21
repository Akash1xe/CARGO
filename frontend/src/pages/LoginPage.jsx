import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const headings = {
  login: ['Welcome back.', 'Sign in to manage shipments and cargo bookings.'],
  register: ['Create your account.', 'Start booking verified intercity cargo capacity.'],
  otp: ['Verify your email.', 'Enter the code we sent to complete your CargoFlow account.'],
};

function TrustMark({ tone, title, copy, icon }) {
  return (
    <div className="auth-trust-item">
      <span className={`auth-trust-icon auth-trust-icon-${tone}`} aria-hidden="true">{icon}</span>
      <span><strong>{title}</strong><small>{copy}</small></span>
    </div>
  );
}

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAuthStore((state) => state.setUser);
  const showToast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regData, setRegData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', accountType: 'CUSTOMER' });
  const registrationDraft = useRef(regData);
  const submittedRegistration = useRef(null);
  const [otp, setOtp] = useState('');

  const requestedRedirect = searchParams.get('redirect');

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authApi.login(email, password);
      const user = response.loggedInUser || response.data?.user || response.data;
      setUser(user);
      showToast('Login successful!', 'success');
      navigate(requestedRedirect || (user?.role === 'ADMIN' ? '/admin' : '/'), { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    const registrationData = { ...regData };
    if (registrationData.password !== registrationData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    submittedRegistration.current = registrationData;
    setLoading(true);
    try {
      await authApi.sendOtp(registrationData);
      showToast('OTP sent to your email!', 'success');
      setTab('otp');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.verifyOtp(otp);
      showToast('Email verified! Please log in.', 'success');
      setEmail(regData.email);
      setTab('login');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const selectTab = (nextTab) => {
    if (loading) return;
    setTab(nextTab);
    setError('');
  };

  const updateRegistrationField = (field, value) => {
    const nextRegistrationData = { ...registrationDraft.current, [field]: value };
    registrationDraft.current = nextRegistrationData;
    setRegData(nextRegistrationData);
  };

  const returnToRegistration = () => {
    const restoredRegistration = { ...(submittedRegistration.current || registrationDraft.current) };
    registrationDraft.current = restoredRegistration;
    setRegData(restoredRegistration);
    selectTab('register');
  };

  return (
    <section className="auth-page" aria-labelledby="auth-heading">
      <aside className="auth-campaign" aria-label="CargoFlow freight campaign">
        <span className="auth-campaign-chevron" aria-hidden="true" />
        <span className="auth-line auth-line-top" aria-hidden="true" />
        <span className="auth-line auth-line-bottom" aria-hidden="true" />
        <div className="auth-campaign-copy">
          <p className="auth-kicker">Cargo capacity that keeps business moving</p>
          <h2>Move business forward.</h2>
          <p>Connect major hubs with verified operators and reliable, bookable capacity.</p>
        </div>
        <div className="auth-campaign-callout">Capacity connects opportunity.<span /></div>
        <img src="/assets/cargoflow/auth-freight-panel.webp" alt="CargoFlow container truck for intercity freight" width="1100" height="1631" />
      </aside>

      <div className="auth-form-side">
        <div className="auth-card">
          <header className="auth-card-heading">
            <p className="auth-card-kicker">CargoFlow account access</p>
            <h1 id="auth-heading">{headings[tab][0]}</h1>
            <p>{headings[tab][1]}</p>
          </header>

          {tab !== 'otp' && (
            <div className="auth-tabs" role="tablist" aria-label="Authentication options">
              <button type="button" role="tab" aria-selected={tab === 'login'} aria-controls="login-panel" disabled={loading} onClick={() => selectTab('login')}>Sign in</button>
              <button type="button" role="tab" aria-selected={tab === 'register'} aria-controls="register-panel" disabled={loading} onClick={() => selectTab('register')}>Create account</button>
            </div>
          )}

          {error && <div id="auth-form-error" className="auth-error" role="alert" aria-live="assertive">{error}</div>}

          <form hidden={tab !== 'login'} id="login-panel" role="tabpanel" aria-labelledby="auth-heading" aria-describedby={error ? 'auth-form-error' : undefined} onSubmit={handleLogin} className="auth-form">
              <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="e.g. name@company.com" autoComplete="email" required />
              <Input label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
              <Button type="submit" loading={loading} className="auth-submit">Sign in</Button>
          </form>

          <form hidden={tab !== 'register'} id="register-panel" role="tabpanel" aria-labelledby="auth-heading" aria-describedby={error ? 'auth-form-error' : undefined} onSubmit={handleRegister} className="auth-form">
              <div className="auth-name-row">
                <Input label="First name" value={regData.firstName} onChange={(event) => updateRegistrationField('firstName', event.target.value)} autoComplete="given-name" required />
                <Input label="Last name" value={regData.lastName} onChange={(event) => updateRegistrationField('lastName', event.target.value)} autoComplete="family-name" required />
              </div>
              <Input label="Email" type="email" value={regData.email} onChange={(event) => updateRegistrationField('email', event.target.value)} placeholder="e.g. name@company.com" autoComplete="email" required />
              <Input label="Password" type="password" value={regData.password} onChange={(event) => updateRegistrationField('password', event.target.value)} autoComplete="new-password" required />
              <Input label="Confirm password" type="password" value={regData.confirmPassword} onChange={(event) => updateRegistrationField('confirmPassword', event.target.value)} autoComplete="new-password" required />
              <fieldset className="auth-account-type">
                <legend>Account type</legend>
                <label className={regData.accountType === 'CUSTOMER' ? 'is-selected' : ''}>
                  <input type="radio" name="accountType" value="CUSTOMER" checked={regData.accountType === 'CUSTOMER'} onChange={(event) => updateRegistrationField('accountType', event.target.value)} />
                  <span><strong>Customer</strong><small>Search capacity and book shipments</small></span>
                </label>
                <label className={regData.accountType === 'ADMIN' ? 'is-selected' : ''}>
                  <input type="radio" name="accountType" value="ADMIN" checked={regData.accountType === 'ADMIN'} onChange={(event) => updateRegistrationField('accountType', event.target.value)} />
                  <span><strong>Administrator</strong><small>Demo access to CargoFlow operations</small></span>
                </label>
              </fieldset>
              <Button type="submit" loading={loading} className="auth-submit">Create account</Button>
          </form>

          <form hidden={tab !== 'otp'} id="otp-panel" aria-labelledby="auth-heading" aria-describedby={error ? 'auth-form-error' : 'otp-destination'} onSubmit={handleVerifyOtp} className="auth-form">
              <p id="otp-destination" className="otp-destination">Verification code sent to <strong>{regData.email}</strong></p>
              <Input label="Six-digit verification code" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Enter 6-digit code" maxLength={6} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
              <Button type="submit" loading={loading} className="auth-submit">Verify OTP</Button>
              <button type="button" disabled={loading} onClick={returnToRegistration} className="auth-back-button"><span aria-hidden="true">←</span> Back to registration</button>
          </form>

          <div className="auth-trust-strip" aria-label="CargoFlow service benefits">
            <TrustMark tone="blue" icon="◇" title="Trusted operators" copy="Verified. Compliant." />
            <TrustMark tone="coral" icon="✓" title="Transparent pricing" copy="No hidden costs." />
            <TrustMark tone="plain" icon="↯" title="Real-time availability" copy="Book with confidence." />
          </div>
        </div>
      </div>
    </section>
  );
}
