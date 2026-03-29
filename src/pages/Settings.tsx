import { useState } from 'react';
import { User, Clock, MapPin, Database, LogOut, Info, Shield, KeyRound, Eye, EyeOff, RefreshCw, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useDoctors } from '../hooks/useDoctors';
import { useRoutes } from '../hooks/useRoutes';
import { useVisits } from '../hooks/useVisits';
import { Modal } from '../components/common/Modal';
import { ButtonLoading } from '../components/common/Loading';

export function SettingsPage() {
  const { user, logout, updateUser, changePassword } = useAuth();
  const { settings, updateSettings } = useApp();
  const { doctors } = useDoctors();
  const { routes } = useRoutes();
  const { visits } = useVisits();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showWorkHoursModal, setShowWorkHoursModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [profileName, setProfileName] = useState(user?.name || '');
  const [workStartTime, setWorkStartTime] = useState(settings?.workStartTime || '07:00');
  const [workEndTime, setWorkEndTime] = useState(settings?.workEndTime || '19:00');
  const [defaultVisitDuration, setDefaultVisitDuration] = useState(settings?.defaultVisitDuration || 10);
  const [defaultVisitsPerDay, setDefaultVisitsPerDay] = useState(settings?.defaultVisitsPerDay || 8);
  const [minimumInterval, setMinimumInterval] = useState(settings?.minimumInterval || 15);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleStartDay, setCycleStartDay] = useState(settings?.cycleStartDay ?? 1);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateUser({ name: profileName });
      setShowProfileModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWorkHours = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        workStartTime,
        workEndTime,
        defaultVisitDuration,
        defaultVisitsPerDay,
        minimumInterval
      });
      setShowWorkHoursModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }
    setIsSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowPasswordModal(false);
      }, 2000);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPasswordError('Senha atual incorreta.');
      } else {
        setPasswordError('Erro ao alterar senha. Tente novamente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCycle = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ cycleStartDay });
      setShowCycleModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-semibold">Configurações</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* User Profile */}
        <div className="card">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowProfileModal(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{user?.name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Work Hours */}
        <div className="card">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setShowWorkHoursModal(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Horário de Trabalho</p>
                <p className="text-sm text-gray-500">
                  {settings?.workStartTime || '07:00'} - {settings?.workEndTime || '19:00'}
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Data Stats */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Meus Dados</p>
              <p className="text-sm text-gray-500">Armazenados na nuvem</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center border-t border-gray-100 pt-4">
            <div>
              <p className="text-lg font-semibold text-gray-900">{doctors.length}</p>
              <p className="text-xs text-gray-500">Médicos</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{routes.length}</p>
              <p className="text-xs text-gray-500">Roteiros</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{visits.length}</p>
              <p className="text-xs text-gray-500">Visitas</p>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <button
            className="w-full flex items-center gap-3"
            onClick={() => { setShowPasswordModal(true); setPasswordError(''); setPasswordSuccess(false); }}
          >
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Alterar Senha</p>
              <p className="text-sm text-gray-500">Altere sua senha de acesso</p>
            </div>
          </button>
        </div>

        {/* About */}
        <div className="card">
          <button
            className="w-full flex items-center gap-3"
            onClick={() => setShowAboutModal(true)}
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Sobre o App</p>
              <p className="text-sm text-gray-500">MedVisit v1.0.0</p>
            </div>
          </button>
        </div>

        {/* Cycle Settings */}
        <div className="card">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => { setCycleStartDay(settings?.cycleStartDay ?? 1); setShowCycleModal(true); }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Ciclo de Visitas</p>
                <p className="text-sm text-gray-500">
                  {(settings?.cycleStartDay ?? 1) === 1
                    ? 'Dia 1 ao último dia do mês'
                    : `Dia ${settings?.cycleStartDay} ao dia ${(settings?.cycleStartDay ?? 1) - 1} do mês seguinte`}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full card flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <LogOut className="w-5 h-5" />
          </div>
          <span className="font-medium">Sair da conta</span>
        </button>
      </div>

      {/* Profile Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Editar Perfil"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input
              type="text"
              className="input"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input bg-gray-50"
              value={user?.email || ''}
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowProfileModal(false)}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="btn-primary flex-1"
            >
              {isSaving ? <ButtonLoading /> : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Work Hours Modal */}
      <Modal
        isOpen={showWorkHoursModal}
        onClose={() => setShowWorkHoursModal(false)}
        title="Configurações de Trabalho"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Início do expediente</label>
              <input
                type="time"
                className="input"
                value={workStartTime}
                onChange={e => setWorkStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Fim do expediente</label>
              <input
                type="time"
                className="input"
                value={workEndTime}
                onChange={e => setWorkEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Duração padrão da visita (minutos)</label>
            <input
              type="number"
              className="input"
              min={5}
              max={120}
              step={5}
              value={defaultVisitDuration}
              onChange={e => setDefaultVisitDuration(parseInt(e.target.value))}
            />
          </div>

          <div>
            <label className="label">Visitas por dia (padrão)</label>
            <input
              type="number"
              className="input"
              min={1}
              max={20}
              value={defaultVisitsPerDay}
              onChange={e => setDefaultVisitsPerDay(parseInt(e.target.value))}
            />
          </div>

          <div>
            <label className="label">Intervalo mínimo entre visitas (minutos)</label>
            <input
              type="number"
              className="input"
              min={5}
              max={60}
              step={5}
              value={minimumInterval}
              onChange={e => setMinimumInterval(parseInt(e.target.value))}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowWorkHoursModal(false)}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveWorkHours}
              disabled={isSaving}
              className="btn-primary flex-1"
            >
              {isSaving ? <ButtonLoading /> : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cycle Modal */}
      <Modal isOpen={showCycleModal} onClose={() => setShowCycleModal(false)} title="Ciclo de Visitas">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Define o período de contagem de visitas. O ciclo começa no dia selecionado de cada mês e termina no dia anterior do mês seguinte.
          </p>
          <div>
            <label className="label">Dia de início do ciclo (1–28)</label>
            <input
              type="number"
              className="input"
              min={1}
              max={28}
              value={cycleStartDay}
              onChange={e => setCycleStartDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
            />
            <p className="text-xs text-gray-400 mt-1">
              {cycleStartDay === 1
                ? 'Ciclo: dia 1 ao último dia do mês'
                : `Ciclo: dia ${cycleStartDay} ao dia ${cycleStartDay - 1} do mês seguinte`}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCycleModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSaveCycle} disabled={isSaving} className="btn-primary flex-1">
              {isSaving ? <ButtonLoading /> : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Alterar Senha"
      >
        <div className="space-y-4">
          {passwordSuccess ? (
            <div className="bg-green-50 text-green-700 rounded-lg px-4 py-3 text-sm font-medium text-center">
              Senha alterada com sucesso!
            </div>
          ) : (
            <>
              <div>
                <label className="label">Senha atual</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    className="input pr-10"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Nova senha</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    className="input pr-10"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Confirmar nova senha</label>
                <input
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{passwordError}</p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowPasswordModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
                  className="btn-primary flex-1"
                >
                  {isSaving ? <ButtonLoading /> : 'Alterar'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* About Modal */}
      <Modal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        title="Sobre o MedVisit"
      >
        <div className="space-y-4 text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-blue-600 flex items-center justify-center">
            <MapPin className="w-10 h-10 text-white" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">MedVisit</h2>
            <p className="text-gray-500">Versão 1.0.0</p>
          </div>

          <p className="text-sm text-gray-600">
            Aplicativo para representantes farmacêuticos gerenciarem suas visitas médicas de forma eficiente.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="w-4 h-4" />
              <span className="font-medium">Seus dados são seguros</span>
            </div>
            <p>Todos os dados são armazenados na nuvem com segurança e acesso controlado pelo administrador.</p>
          </div>

          <button
            onClick={() => setShowAboutModal(false)}
            className="btn-primary w-full"
          >
            Fechar
          </button>
        </div>
      </Modal>
    </div>
  );
}
