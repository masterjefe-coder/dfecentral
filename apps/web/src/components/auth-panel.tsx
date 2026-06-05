'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

type Props = {
  mode: Mode;
  token?: string;
  redirectTo?: string;
  initialError?: string;
};

const copy = {
  login: {
    title: 'Entrar',
    description: 'Acesse o dashboard, relatórios, integrações e seu plano ativo.',
    action: 'Entrar',
  },
  register: {
    title: 'Criar conta',
    description: 'Crie sua conta e escolha o plano ideal para começar.',
    action: 'Criar conta',
  },
  forgot: {
    title: 'Recuperar senha',
    description: 'Enviaremos um link de redefinição para seu e-mail.',
    action: 'Enviar link',
  },
  reset: {
    title: 'Redefinir senha',
    description: 'Defina uma nova senha para continuar.',
    action: 'Redefinir',
  },
} as const;

export function AuthPanel({ mode, token, redirectTo = '/dashboard', initialError = '' }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(initialError);
  const [sucesso, setSucesso] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', senha: '', cnpj: '', confirmarSenha: '' });

  const meta = copy[mode];
  const publicWebBase = process.env.WEB_BASE_URL || process.env.APP_BASE_URL || 'https://www.dfecentral.com.br';
  const googleHref = `${publicWebBase.replace(/\/$/, '')}/api/auth/google/iniciar?next=${encodeURIComponent(redirectTo)}`;

  function emailValido(valor: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro('');
    setSucesso('');

    if ((mode === 'login' || mode === 'forgot' || mode === 'register') && !emailValido(form.email)) {
      setErro('Informe um e-mail valido.');
      return;
    }
    if ((mode === 'login' || mode === 'register') && !form.senha.trim()) {
      setErro('Informe uma senha.');
      return;
    }
    if (mode === 'register' && form.nome.trim().length < 2) {
      setErro('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    if (mode === 'register' && form.cnpj.trim() && !/^\d{14}$/.test(form.cnpj.replace(/\D/g, ''))) {
      setErro('Informe um CNPJ valido se quiser preencher esse campo.');
      return;
    }
    if (mode === 'reset' && !token) {
      setErro('Token de redefinição ausente.');
      return;
    }
    if ((mode === 'register' || mode === 'reset') && form.senha !== form.confirmarSenha) {
      setErro('As senhas precisam ser iguais.');
      return;
    }

    setLoading(true);
    try {
      const payload =
        mode === 'login'
          ? { email: form.email, senha: form.senha }
          : mode === 'register'
            ? { nome: form.nome, email: form.email, senha: form.senha, cnpj: form.cnpj || undefined }
            : mode === 'forgot'
              ? { email: form.email }
              : { token, senha: form.senha };

      const endpoint = mode === 'login' ? '/api/auth/entrar' : mode === 'register' ? '/api/auth/cadastrar' : mode === 'forgot' ? '/api/auth/esqueci-senha' : '/api/auth/redefinir';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.sucesso) {
        setErro(data.erro || 'Nao foi possivel concluir a operacao.');
        return;
      }

      if (mode === 'forgot') {
        setSucesso(data.dados?.recuperacaoUrl || 'Verifique seu e-mail para redefinir a senha.');
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setErro('Nao foi possivel concluir a operacao.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="surface-card-strong rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">{mode === 'login' ? 'Acesso' : 'Conta'}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{meta.title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{meta.description}</p>
          </div>
          <Link href="/" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950">
            Site
          </Link>
        </div>

        {mode === 'login' ? (
          <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            Ainda não tem conta?{' '}
            <Link href="/auth/cadastrar" className="font-semibold underline decoration-cyan-400/60 underline-offset-4 hover:text-cyan-950">
              Criar conta grátis
            </Link>
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === 'register' ? (
            <Field label="Nome" value={form.nome} onChange={(value) => setForm((prev) => ({ ...prev, nome: value }))} />
          ) : null}
          <Field label="E-mail" type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} />
          {mode === 'register' ? <Field label="CNPJ (opcional)" value={form.cnpj} onChange={(value) => setForm((prev) => ({ ...prev, cnpj: value }))} /> : null}
          {mode !== 'forgot' ? (
            <Field label="Senha" type="password" value={form.senha} onChange={(value) => setForm((prev) => ({ ...prev, senha: value }))} />
          ) : null}
          {mode === 'register' || mode === 'reset' ? (
            <Field label="Confirmar senha" type="password" value={form.confirmarSenha} onChange={(value) => setForm((prev) => ({ ...prev, confirmarSenha: value }))} />
          ) : null}

          {erro ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {erro}
              {erro === 'google_indisponivel' ? (
                <span className="mt-1 block text-xs text-red-700">O Google OAuth ainda precisa de `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` na VM.</span>
              ) : null}
            </p>
          ) : null}
          {sucesso ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{sucesso}</p> : null}

          {mode === 'login' ? <p className="text-xs leading-5 text-slate-500">Ao entrar, você acessa o dashboard, consultas, integrações e seu plano ativo.</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Processando...' : meta.action}
          </button>

          {mode === 'login' || mode === 'register' ? (
            <a href={googleHref} className="inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-500 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-600 transition-colors">
              Entrar com Google
            </a>
          ) : null}

          {mode === 'login' ? (
            <Link href="/auth/cadastrar" className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              Criar conta
            </Link>
          ) : null}
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          {mode !== 'login' ? <Link href="/auth/entrar" className="hover:text-slate-900">Já tenho conta</Link> : <Link href="/auth/cadastrar" className="hover:text-slate-900">Criar conta</Link>}
          {mode === 'login' ? <Link href="/auth/esqueci-senha" className="hover:text-slate-900">Esqueci minha senha</Link> : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
      />
    </label>
  );
}
