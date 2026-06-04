'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';

type Usuario = { nome: string; email: string; cnpj?: string | null; plano?: string };
type Empresa = { id: string; nome: string; cnpj: string };
type MembroEquipe = { id: string; nome: string; cnpj: string; usuarioId: string; criadoEm: string };
type ConviteEquipe = { id: string; nome: string; email: string; papel: string; status: string; token: string; criadoEm: string };
type Assinatura = { plano: string; assinaturaStatus: string; assinaturaMetodoPagamento?: string; assinaturaCancelEm?: string | null; assinaturaRenovaEm?: string | null };
type Certificado = { cnpj: string; certificadoCnpj: string; nomeArquivo: string; mimeType: string; tamanhoBytes: number; validadeEm: string; criadoEm: string; atualizadoEm: string };

function validarCnpj(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, '');
  if (nums.length !== 14) return false;
  if (/^(\d)\1+$/.test(nums)) return false;

  const calcular = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, digito, indice) => acc + Number(digito) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base12 = nums.slice(0, 12);
  const digito1 = calcular(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digito2 = calcular(`${base12}${digito1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return nums === `${base12}${digito1}${digito2}`;
}

function formatarCnpj(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 14);
  return nums.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

export default function EmpresaPage() {
  const [aba, setAba] = useState<'dados' | 'equipe' | 'contabilidade'>('dados');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [novaEmpresaCnpj, setNovaEmpresaCnpj] = useState('');
  const [empresaAtiva, setEmpresaAtiva] = useState('');
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [certificado, setCertificado] = useState<Certificado | null>(null);
  const [certificadoArquivo, setCertificadoArquivo] = useState<File | null>(null);
  const [certificadoSenha, setCertificadoSenha] = useState('');
  const [enviandoCertificado, setEnviandoCertificado] = useState(false);
  const [contabilidadeEmail, setContabilidadeEmail] = useState('');
  const [contabilidadeAuto, setContabilidadeAuto] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [convites, setConvites] = useState<ConviteEquipe[]>([]);
  const [novoConviteNome, setNovoConviteNome] = useState('');
  const [novoConviteEmail, setNovoConviteEmail] = useState('');
  const [novoConvitePapel, setNovoConvitePapel] = useState<'membro' | 'contabilidade' | 'admin'>('membro');
  const [xmlChave, setXmlChave] = useState('');
  const [xmlEmail, setXmlEmail] = useState('');
  const [enviandoXml, setEnviandoXml] = useState(false);
  const [pacoteMes, setPacoteMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [pacoteIncluirEntradas, setPacoteIncluirEntradas] = useState(false);
  const [enviandoPacote, setEnviandoPacote] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const nomeInvalido = nome.trim().length < 2;
  const cnpjLimpo = cnpj.replace(/\D/g, '').slice(0, 14);
  const cnpjInvalido = cnpjLimpo.length > 0 ? !validarCnpj(cnpjLimpo) : true;
  const certificadoExpiraEm = certificado?.validadeEm ? new Date(certificado.validadeEm) : null;
  const certificadoExpiraEmBreve = certificadoExpiraEm ? (certificadoExpiraEm.getTime() - Date.now()) < 1000 * 60 * 60 * 24 * 30 : false;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('erro') === 'cnpj_assinatura') {
      setMensagem('Cadastre ou selecione um CNPJ ativo antes de assinar um plano.');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [meRes, empresasRes, ativaRes, prefsRes, equipeRes, assinaturaRes, certificadoRes] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/empresas', { cache: 'no-store' }),
        fetch('/api/empresas/ativa', { cache: 'no-store' }),
        fetch('/api/auth/prefs', { cache: 'no-store' }),
        fetch('/api/equipe', { cache: 'no-store' }),
        fetch('/api/billing/subscription', { cache: 'no-store' }),
        fetch('/api/certificados', { cache: 'no-store' }),
      ]);
      const meData = await meRes.json();
      let cnpjCarregado = '';
      if (meData.sucesso) {
        const info = meData.dados?.usuario as Usuario;
        setUsuario(info);
        setNome(info?.nome || '');
        cnpjCarregado = info?.cnpj || '';
      }

      const empresasData = await empresasRes.json();
      if (empresasData.sucesso) {
        const listaEmpresas = empresasData.dados?.empresas || [];
        setEmpresas(listaEmpresas);
        if (!cnpjCarregado && listaEmpresas[0]?.cnpj) {
          cnpjCarregado = listaEmpresas[0].cnpj;
        }
      }
      const ativaData = await ativaRes.json();
      if (ativaData.sucesso) {
        const cnpjAtivo = ativaData.dados?.cnpjAtivo || '';
        setEmpresaAtiva(cnpjAtivo);
        if (cnpjAtivo) cnpjCarregado = cnpjAtivo;
      }

      setCnpj(cnpjCarregado);

      const prefsData = await prefsRes.json();
      if (prefsData.sucesso && prefsData.dados?.preferencias) {
        const prefs = prefsData.dados.preferencias as Record<string, unknown>;
        if (typeof prefs.contabilidadeEmail === 'string') setContabilidadeEmail(prefs.contabilidadeEmail);
        if (typeof prefs.contabilidadeEnvioAutomatico === 'boolean') setContabilidadeAuto(prefs.contabilidadeEnvioAutomatico);
        if (typeof prefs.recebeaquiWebhookUrl === 'string') setWebhookUrl(prefs.recebeaquiWebhookUrl);
      }

      const equipeData = await equipeRes.json();
      if (equipeData.sucesso) {
        setMembros(equipeData.dados?.membros || []);
        setConvites(equipeData.dados?.convites || []);
      }

      const assinaturaData = await assinaturaRes.json();
      if (assinaturaData.sucesso) {
        setAssinatura(assinaturaData.dados?.assinatura || null);
      }

      const certificadoData = await certificadoRes.json();
      if (certificadoData.sucesso) {
        setCertificado(certificadoData.dados?.certificado || null);
      }
    })();
  }, []);

  async function definirAtiva(cnpjAtivo: string) {
    const res = await fetch('/api/empresas/ativa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpjAtivo }),
    });
    const data = await res.json();
    if (data.sucesso) {
      setEmpresaAtiva(data.dados?.cnpjAtivo || '');
    }
  }

  async function salvar() {
    if (nomeInvalido) {
      setMensagem('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    if (cnpjInvalido) {
      setMensagem('Informe um CNPJ valido antes de salvar.');
      return;
    }

    setSalvando(true);
    setMensagem('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cnpj }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel salvar.');
        return;
      }
      const info = data.dados?.usuario as Usuario;
      setUsuario(info);
      if (typeof info?.cnpj === 'string' && info.cnpj.trim()) {
        setCnpj(info.cnpj);
      }
      setMensagem('Dados atualizados.');

      await fetch('/api/auth/prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contabilidadeEmail: contabilidadeEmail || null,
          contabilidadeEnvioAutomatico: contabilidadeAuto,
          recebeaquiWebhookUrl: webhookUrl || null,
        }),
      });

      if (cnpjLimpo.length === 14) {
        await fetch('/api/empresas/ativa', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cnpjAtivo: cnpjLimpo }),
        });
        setEmpresaAtiva(cnpjLimpo);
        setCnpj(formatarCnpj(cnpjLimpo));
      }
    } finally {
      setSalvando(false);
    }
  }

  async function arquivoParaBase64(arquivo: File): Promise<string> {
    const buffer = await arquivo.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binario = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binario += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binario);
  }

  async function salvarCertificado() {
    if (!certificadoArquivo) {
      setMensagem('Selecione o arquivo .pfx/.p12 do certificado.');
      return;
    }
    if (!certificadoSenha.trim()) {
      setMensagem('Informe a senha do certificado.');
      return;
    }

    const cnpjAlvo = (empresaAtiva || cnpj).replace(/\D/g, '').slice(0, 14);
    if (cnpjAlvo.length !== 14) {
      setMensagem('Defina um CNPJ ativo antes de enviar o certificado.');
      return;
    }

    setEnviandoCertificado(true);
    setMensagem('');
    try {
      const res = await fetch('/api/certificados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: cnpjAlvo,
          senha: certificadoSenha,
          arquivoBase64: await arquivoParaBase64(certificadoArquivo),
          nomeArquivo: certificadoArquivo.name,
          mimeType: certificadoArquivo.type || 'application/x-pkcs12',
        }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel salvar o certificado.');
        return;
      }

      setCertificado(data.dados?.certificado || null);
      setCertificadoArquivo(null);
      setCertificadoSenha('');
      setMensagem(data.dados?.aviso || 'Certificado salvo com segurança.');
    } finally {
      setEnviandoCertificado(false);
    }
  }

  async function removerCertificado() {
    const cnpjAlvo = (empresaAtiva || cnpj).replace(/\D/g, '').slice(0, 14);
    const res = await fetch(`/api/certificados?cnpj=${encodeURIComponent(cnpjAlvo)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel remover o certificado.');
      return;
    }
    setCertificado(null);
    setMensagem('Certificado removido.');
  }

  async function convidarMembro() {
    const res = await fetch('/api/equipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: novoConviteNome, email: novoConviteEmail, papel: novoConvitePapel, cnpj }),
    });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel enviar o convite.');
      return;
    }

    setConvites((atual) => [data.dados.convite, ...atual]);
    setMensagem('Convite enviado por e-mail.');
    setNovoConviteNome('');
    setNovoConviteEmail('');
    setNovoConvitePapel('membro');
  }

  async function removerConvite(id: string) {
    const res = await fetch(`/api/equipe/convites/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel remover o convite.');
      return;
    }

    setConvites((atual) => atual.filter((item) => item.id !== id));
    setMensagem('Convite removido.');
  }

  async function enviarXmlContabilidade() {
    if (!xmlChave.trim()) {
      setMensagem('Informe a chave do documento para enviar o XML.');
      return;
    }

    setEnviandoXml(true);
    setMensagem('');
    try {
      const res = await fetch('/api/contabilidade/xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: xmlChave.trim(), email: xmlEmail || undefined }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel enviar o XML.');
        return;
      }
      setMensagem(`XML enviado para ${data.dados?.email || 'contabilidade'}.`);
      setXmlChave('');
      setXmlEmail('');
    } finally {
      setEnviandoXml(false);
    }
  }

  async function enviarPacoteMensal() {
    if (!pacoteMes.trim()) {
      setMensagem('Informe o mes no formato AAAA-MM.');
      return;
    }

    setEnviandoPacote(true);
    setMensagem('');
    try {
      const res = await fetch('/api/contabilidade/pacote-mensal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: pacoteMes.trim(), incluirEntradas: pacoteIncluirEntradas }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel gerar o pacote mensal.');
        return;
      }
      setMensagem(`Pacote ZIP de ${data.dados?.mes} enviado para ${data.dados?.email || 'contabilidade'} com ${data.dados?.total || 0} XMLs.`);
    } finally {
      setEnviandoPacote(false);
    }
  }

  async function baixarPacoteMensal() {
    if (!pacoteMes.trim()) {
      setMensagem('Informe o mes no formato AAAA-MM.');
      return;
    }

    setEnviandoPacote(true);
    setMensagem('');
    try {
      const res = await fetch('/api/contabilidade/pacote-mensal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: pacoteMes.trim(), incluirEntradas: pacoteIncluirEntradas }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMensagem(data.erro || 'Nao foi possivel baixar o pacote mensal.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `xmls-${pacoteMes.replace('-', '_')}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMensagem('Download do ZIP iniciado.');
    } finally {
      setEnviandoPacote(false);
    }
  }

  async function cancelarAssinatura() {
    if (!window.confirm('Cancelar a assinatura? O acesso continua até a data informada e depois o plano volta para free.')) return;

    const res = await fetch('/api/billing/subscription/cancel', { method: 'POST' });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel cancelar a assinatura.');
      return;
    }
    setAssinatura((atual) => atual ? { ...atual, assinaturaStatus: 'cancelada', assinaturaCancelEm: data.dados?.cancelEm || atual.assinaturaCancelEm } : atual);
    setMensagem(`Assinatura cancelada. Acesso mantido até ${data.dados?.cancelEm ? new Date(data.dados.cancelEm).toLocaleDateString('pt-BR') : 'o fim do período atual'}.`);
  }

  async function restaurarAssinatura() {
    const res = await fetch('/api/billing/subscription/restore', { method: 'POST' });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel restaurar a assinatura.');
      return;
    }
    setAssinatura((atual) => atual ? { ...atual, assinaturaStatus: 'ativa', assinaturaCancelEm: null } : atual);
    setMensagem('Assinatura restaurada.');
  }

  async function renovarAgora() {
    const res = await fetch('/api/billing/subscription/renew-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodoPagamento: assinatura?.assinaturaMetodoPagamento || 'cartao' }),
    });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel gerar o checkout de renovacao.');
      return;
    }
    window.location.href = data.dados.checkoutUrl;
  }

  async function trocarMetodoAssinatura() {
    const metodoNovo = assinatura?.assinaturaMetodoPagamento === 'pix' ? 'cartao' : 'pix';
    const res = await fetch('/api/billing/subscription/renew-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodoPagamento: metodoNovo }),
    });
    const data = await res.json();
    if (!data.sucesso) {
      setMensagem(data.erro || 'Nao foi possivel gerar a troca de cobrança.');
      return;
    }
    window.location.href = data.dados.checkoutUrl;
  }

  function adicionarEmpresa() {
    const cnpjLimpo = novaEmpresaCnpj.replace(/\D/g, '').slice(0, 14);
    if (novaEmpresaNome.trim().length < 2) {
      setMensagem('Informe um nome com pelo menos 2 caracteres para a empresa.');
      return;
    }
    if (!validarCnpj(cnpjLimpo)) {
      setMensagem('Informe um CNPJ valido para adicionar outra empresa.');
      return;
    }

    void (async () => {
      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novaEmpresaNome.trim(), cnpj: cnpjLimpo }),
      });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel adicionar a empresa.');
        return;
      }

      setEmpresas((atual) => [data.dados.empresa, ...atual.filter((item) => item.cnpj !== cnpjLimpo)]);
      setNovaEmpresaNome('');
      setNovaEmpresaCnpj('');
      setMensagem('Empresa adicionada.');
      if (!empresaAtiva) {
        await fetch('/api/empresas/ativa', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cnpjAtivo: cnpjLimpo }),
        });
        setEmpresaAtiva(cnpjLimpo);
      }
    })();
  }

  function removerEmpresa(id: string) {
    void (async () => {
      const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.sucesso) {
        setMensagem(data.erro || 'Nao foi possivel remover a empresa.');
        return;
      }

      setEmpresas((atual) => atual.filter((item) => item.id !== id));
      setMensagem('Empresa removida.');
    })();
  }

  return (
    <AppShell active="/empresa" title="Empresa" description="Dados da conta, empresas adicionais, assinatura, certificados e integrações em um só lugar.">
      <div className="space-y-6">
        <section className="surface-card-strong rounded-[2rem] border border-slate-200 bg-white/90 p-6 sm:p-8 backdrop-blur shadow-2xl shadow-slate-900/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">Configuração da empresa</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Dados da conta</h1>
          <p className="mt-2 text-sm text-slate-600">Atualize o nome exibido, valide o CNPJ principal e mantenha os certificados e integrações em dia.</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ['dados', 'Dados'],
              ['equipe', 'Equipe'],
              ['contabilidade', 'Contabilidade'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAba(key as 'dados' | 'equipe' | 'contabilidade')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  aba === key ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {aba === 'dados' ? (
            <div className="mt-6 grid gap-4">
              <Field label="Nome" value={nome} onChange={setNome} placeholder="Nome comercial ou razão social" />
              <Field label="CNPJ" value={cnpj} onChange={(valor) => setCnpj(formatarCnpj(valor))} placeholder="00.000.000/0000-00" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className={`rounded-2xl border px-4 py-3 text-sm ${nomeInvalido ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
                  {nomeInvalido ? 'Informe um nome com pelo menos 2 caracteres.' : 'Nome válido.'}
                </div>
                <div className={`rounded-2xl border px-4 py-3 text-sm ${cnpjInvalido ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
                  {cnpjInvalido ? 'CNPJ inválido ou incompleto.' : `CNPJ válido: ${formatarCnpj(cnpjLimpo)}`}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Info label="E-mail" value={usuario?.email || '-'} />
                <Info label="Plano" value={usuario?.plano?.toUpperCase() || '-'} />
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Empresa ativa</p>
                <p className="mt-2 font-mono text-slate-950">{empresaAtiva ? formatarCnpj(empresaAtiva) : 'Nenhuma selecionada'}</p>
              </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Multiempresa local</p>
              <p className="mt-2 text-sm text-slate-600">Lista auxiliar de CNPJs para uso rápido no dia a dia.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <Field label="Nome da empresa" value={novaEmpresaNome} onChange={setNovaEmpresaNome} />
                <Field label="CNPJ" value={novaEmpresaCnpj} onChange={setNovaEmpresaCnpj} />
                <button onClick={adicionarEmpresa} className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800">
                  Adicionar
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                {empresas.length === 0 ? <p className="text-sm text-slate-500">Nenhuma empresa adicional cadastrada.</p> : null}
                {empresas.map((empresa) => (
                  <div key={empresa.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{empresa.nome}</p>
                      <p className="font-mono text-xs text-slate-500">{empresa.cnpj}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void definirAtiva(empresa.cnpj)} className={`rounded-full px-3 py-1 text-xs font-semibold ${empresaAtiva === empresa.cnpj ? 'bg-emerald-500 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}>
                        {empresaAtiva === empresa.cnpj ? 'Ativa' : 'Ativar'}
                      </button>
                      <button onClick={() => removerEmpresa(empresa.id)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Empresa ativa</p>
              <p className="mt-2 text-sm text-slate-600">{empresaAtiva || 'Nenhuma selecionada'}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Assinatura</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950 ring-1 ring-slate-200">{assinatura?.plano?.toUpperCase() || usuario?.plano?.toUpperCase() || '-'}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{assinatura?.assinaturaStatus?.toUpperCase() || 'ATIVA'}</span>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">{(assinatura?.assinaturaMetodoPagamento || 'cartao').toUpperCase()}</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {assinatura?.assinaturaCancelEm
                  ? `Se cancelada, o acesso termina em ${new Date(assinatura.assinaturaCancelEm).toLocaleDateString('pt-BR')}.`
                  : `A assinatura está ativa e libera o acesso conforme o plano. Cobrança atual: ${(assinatura?.assinaturaMetodoPagamento || 'cartao') === 'pix' ? 'PIX' : 'cartão de crédito'}.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={renovarAgora} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                  Renovar agora
                </button>
                <button onClick={trocarMetodoAssinatura} className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100">
                  {(assinatura?.assinaturaMetodoPagamento || 'cartao') === 'pix' ? 'Trocar para cartão' : 'Trocar para PIX'}
                </button>
                {assinatura?.assinaturaStatus === 'cancelada' ? (
                  <button onClick={restaurarAssinatura} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    Reativar
                  </button>
                ) : (
                  <button onClick={cancelarAssinatura} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                    Cancelar assinatura
                  </button>
                )}
                <Link href={`/precos?plano=${(assinatura?.plano || usuario?.plano || 'starter').toLowerCase()}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  Ver planos
                </Link>
              </div>
            </div>

            <div id="certificados" className="rounded-3xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">Certificado digital</p>
              <p className="mt-2 text-sm text-slate-700">
                O certificado do CNPJ ativo fica criptografado no servidor e é usado para consultas oficiais e importação automática.
              </p>
              {certificadoExpiraEmBreve ? (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Atenção: este certificado vence em {certificadoExpiraEm?.toLocaleDateString('pt-BR')}.
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Arquivo .pfx/.p12</span>
                  <input
                    type="file"
                    accept=".pfx,.p12,application/x-pkcs12"
                    onChange={(e) => setCertificadoArquivo(e.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                  />
                </label>
                <Field label="Senha do certificado" value={certificadoSenha} onChange={setCertificadoSenha} type="password" />
                <button onClick={salvarCertificado} disabled={enviandoCertificado} className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-cyan-500 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                  {enviandoCertificado ? 'Salvando...' : certificado ? 'Atualizar certificado' : 'Salvar certificado'}
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                {certificado ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{certificado.nomeArquivo}</p>
                      <p className="text-xs text-slate-500">CNPJ {certificado.certificadoCnpj} | Validade {new Date(certificado.validadeEm).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <button onClick={removerCertificado} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                      Remover certificado
                    </button>
                  </div>
                ) : (
                  <p>Nenhum certificado salvo para este CNPJ ativo.</p>
                )}
              </div>
            </div>
          </div>
          ) : null}

          {aba === 'contabilidade' ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Contabilidade</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="E-mail da contabilidade" value={contabilidadeEmail} onChange={setContabilidadeEmail} />
                <label className="block self-end rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Enviar XML automaticamente</span>
                  <button
                    type="button"
                    onClick={() => setContabilidadeAuto((atual) => !atual)}
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${contabilidadeAuto ? 'bg-emerald-500 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
                  >
                    {contabilidadeAuto ? 'Ativado' : 'Desativado'}
                  </button>
                </label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <Field label="Chave do XML" value={xmlChave} onChange={setXmlChave} />
                <Field label="E-mail opcional" value={xmlEmail} onChange={setXmlEmail} />
                <button onClick={enviarXmlContabilidade} disabled={enviandoXml} className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                  {enviandoXml ? 'Enviando...' : 'Enviar XML'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pacote mensal</p>
              <p className="mt-2 text-sm text-slate-600">Gera um ZIP com os XMLs emitidos no mes e, se quiser, inclui os XMLs de entrada.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto]">
                <Field label="Mês" value={pacoteMes} onChange={setPacoteMes} />
                <label className="block self-end rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Incluir entradas</span>
                  <button
                    type="button"
                    onClick={() => setPacoteIncluirEntradas((atual) => !atual)}
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${pacoteIncluirEntradas ? 'bg-emerald-500 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
                  >
                    {pacoteIncluirEntradas ? 'Sim' : 'Nao'}
                  </button>
                </label>
                <button onClick={enviarPacoteMensal} disabled={enviandoPacote} className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-cyan-500 px-5 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-60">
                  {enviandoPacote ? 'Gerando...' : 'Enviar pacote ZIP'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Webhook</p>
              <p className="mt-2 text-sm text-slate-600">Aqui você pode cadastrar uma URL do seu sistema para receber notificações automáticas sempre que um pagamento for confirmado.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Field label="URL do Webhook" value={webhookUrl} onChange={setWebhookUrl} placeholder="https://seusite.com/webhook" />
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
                  Recebe o evento `pagamento_confirmado` com provedor, tipo, valor e data.
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Fluxo contábil</p>
              <p className="mt-2 text-sm text-slate-600">Defina o e-mail padrão da contabilidade e use esta aba para disparos manuais por chave ou pacote mensal.</p>
            </div>
          </div>
          ) : null}

          {aba === 'equipe' ? (
          <div className="mt-6 grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Equipe</p>
              <p className="mt-2 text-sm text-slate-600">Convide pessoas por e-mail para acessar a mesma operação.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
                <Field label="Nome" value={novoConviteNome} onChange={setNovoConviteNome} />
                <Field label="E-mail" value={novoConviteEmail} onChange={setNovoConviteEmail} />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Papel</span>
                  <select value={novoConvitePapel} onChange={(e) => setNovoConvitePapel(e.target.value as any)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none">
                    <option value="membro">Membro</option>
                    <option value="contabilidade">Contabilidade</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <button onClick={convidarMembro} className="mt-auto inline-flex h-12 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800">Convidar</button>
              </div>

              <div className="mt-4 grid gap-3">
                {membros.length === 0 ? <p className="text-sm text-slate-500">Nenhum membro cadastrado.</p> : null}
                {membros.map((membro) => (
                  <div key={membro.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{membro.nome}</p>
                      <p className="font-mono text-xs text-slate-500">{membro.cnpj}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Acesso</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Convites pendentes</p>
                {convites.length === 0 ? <p className="text-sm text-slate-500">Nenhum convite pendente.</p> : null}
                {convites.map((convite) => (
                  <div key={convite.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{convite.nome}</p>
                      <p className="font-mono text-xs text-slate-500">{convite.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{convite.papel}</span>
                      <button onClick={() => void removerConvite(convite.id)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Remover</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          ) : null}

          {mensagem ? <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{mensagem}</p> : null}
          <button onClick={salvar} disabled={salvando || nomeInvalido || cnpjInvalido} className="inline-flex w-fit rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
