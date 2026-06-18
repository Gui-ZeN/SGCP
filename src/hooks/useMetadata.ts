/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  db, 
  isFirebaseEnabled, 
  collection, 
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  handleFirestoreError,
  OperationType,
  setDoc,
  updateDoc
} from '../lib/firebase';

const USERS_LOCAL_KEY = 'ats_users_fallback';
const SEDES_LOCAL_KEY = 'ats_sedes_fallback';
const REGIOES_LOCAL_KEY = 'ats_regioes_fallback';
const CARGOS_LOCAL_KEY = 'ats_cargos_fallback';
const SETORES_LOCAL_KEY = 'ats_setores_fallback';

export type UserRole = 'Administrador' | 'Coordenador' | 'Analista' | 'Visualizador';

export interface Usuario {
  id: string; // email or unique id
  email: string;
  role: UserRole;
  sede?: string;
}

export interface Sede {
  id: string;
  nome: string;
  regiao: string;
  sigla?: string;
}

export interface Regiao {
  id: string;
  nome: string;
}

export interface Cargo {
  id: string;
  nome: string;
}

export interface Setor {
  id: string;
  nome: string;
}

export function useMetadata(currentUser: any) {
  const hasSeededSetores = useRef(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFirebase, setUsingFirebase] = useState(isFirebaseEnabled);

  // Simulative/Computed Role and overrides for easy Sandbox testing
  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('ats_simulated_role');
    if (saved === 'Administrador' || saved === 'Analista' || saved === 'Visualizador') {
      return saved as UserRole;
    }
    return 'Administrador'; // Default is Administrador so creators see all features out-of-the-box!
  });

  const [isAuthorized, setIsAuthorized] = useState<boolean>(true);

  const [selectedSede, setSelectedSede] = useState<string>(() => {
    const saved = localStorage.getItem('ats_simulated_sede');
    return saved || 'DT';
  });

  const changeSelectedRole = (role: UserRole) => {
    setSelectedRole(role);
    localStorage.setItem('ats_simulated_role', role);
  };

  const changeSelectedSede = (sede: string) => {
    setSelectedSede(sede);
    localStorage.setItem('ats_simulated_sede', sede);
    
    // Also update simulated user saved in local storage if exists
    const savedMock = localStorage.getItem('ats_simulated_user');
    if (savedMock) {
      try {
        const parsed = JSON.parse(savedMock);
        parsed.sede = sede;
        localStorage.setItem('ats_simulated_user', JSON.stringify(parsed));
      } catch (e) {}
    }
  };

  const userRole = selectedRole;
  const isAdmin = selectedRole === 'Administrador';
  const isViewer = selectedRole === 'Visualizador';

  // Initial defaults
  const defaultRegioes: Regiao[] = [
    { id: 'reg_1', nome: 'Sudeste' },
    { id: 'reg_2', nome: 'Sul' },
    { id: 'reg_3', nome: 'Nordeste' },
    { id: 'reg_4', nome: 'Centro-Oeste' }
  ];

  const defaultSedes: Sede[] = [
    { id: 'sede_1', nome: 'DT', regiao: 'Sudeste', sigla: 'DT' },
    { id: 'sede_2', nome: 'Construtora', regiao: 'Sudeste', sigla: 'CON' },
    { id: 'sede_3', nome: 'BENFICA', regiao: 'Sul', sigla: 'BEN' },
    { id: 'sede_4', nome: 'BS', regiao: 'Nordeste', sigla: 'BS' },
    { id: 'sede_5', nome: 'SUL', regiao: 'Sul', sigla: 'SUL' },
    { id: 'sede_6', nome: 'Sul 2', regiao: 'Sul', sigla: 'SL2' },
    { id: 'sede_7', nome: 'Sul 3', regiao: 'Sul', sigla: 'SL3' },
    { id: 'sede_8', nome: 'PQL 1', regiao: 'Sudeste', sigla: 'PQ1' },
    { id: 'sede_9', nome: 'PQL 2', regiao: 'Sudeste', sigla: 'PQ2' },
    { id: 'sede_10', nome: 'PQL 3', regiao: 'Sudeste', sigla: 'PQ3' },
    { id: 'sede_11', nome: 'SP', regiao: 'Sudeste', sigla: 'SP' },
    { id: 'sede_12', nome: 'OFICINA', regiao: 'Sudeste', sigla: 'OFI' },
    { id: 'sede_13', nome: 'EQUIPE D.VALERIA', regiao: 'Sudeste', sigla: 'EDV' }
  ];

  const defaultCargos: Cargo[] = [
    { id: 'cargo_1', nome: 'Auxiliar Administrativo' },
    { id: 'cargo_2', nome: 'Analista de Sistemas' },
    { id: 'cargo_3', nome: 'Analista de RH' },
    { id: 'cargo_4', nome: 'Gerente' },
    { id: 'cargo_5', nome: 'Supervisor' },
    { id: 'cargo_6', nome: 'Recrutador' },
    { id: 'cargo_7', nome: 'Auxiliar de Serviços Gerais' },
    { id: 'cargo_8', nome: 'Oficial de Manutenção' }
  ];

  const defaultSetores: Setor[] = [
    { id: 'setor_1', nome: 'Almoxarifado' },
    { id: 'setor_2', nome: 'Almoxarifado geral' },
    { id: 'setor_3', nome: 'Atendimento' },
    { id: 'setor_4', nome: 'Cantina' },
    { id: 'setor_5', nome: 'Compras' },
    { id: 'setor_6', nome: 'Comunicação Digital' },
    { id: 'setor_7', nome: 'Construtora' },
    { id: 'setor_8', nome: 'Coordenação' },
    { id: 'setor_9', nome: 'CPA' },
    { id: 'setor_10', nome: 'D. Valéria' },
    { id: 'setor_11', nome: 'Idiomas DT' },
    { id: 'setor_12', nome: 'Infra' },
    { id: 'setor_13', nome: 'Infraestrutura' },
    { id: 'setor_14', nome: 'Jurídico' },
    { id: 'setor_15', nome: 'Livros escolares' },
    { id: 'setor_16', nome: 'Lojinha' },
    { id: 'setor_17', nome: 'Marketing' },
    { id: 'setor_18', nome: 'Metalurgica' },
    { id: 'setor_19', nome: 'MKT' },
    { id: 'setor_20', nome: 'Pedagógico' },
    { id: 'setor_21', nome: 'Redes' },
    { id: 'setor_22', nome: 'Secretaria' },
    { id: 'setor_23', nome: 'Som' },
    { id: 'setor_24', nome: 'TI' }
  ];

  const defaultUsuarios: Usuario[] = [
    { id: 'user_1', email: 'guizen2006@gmail.com', role: 'Administrador', sede: 'DT' },
    { id: 'user_2', email: 'recrutamento@empresa.com', role: 'Analista', sede: 'BENFICA' },
    { id: 'user_3', email: 'visualizador@empresa.com', role: 'Visualizador', sede: '' }
  ];

  useEffect(() => {
    if (isFirebaseEnabled && db && currentUser) {
      setLoading(true);

      // 1. Usuarios Realtime Sync
      const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), (snapshot: any) => {
        const list: Usuario[] = [];
        snapshot.forEach((docSnap: any) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Usuario);
        });
        setUsuarios(list);
      }, (error: any) => {
        // Usuário autenticado mas sem permissão (ex.: conta não provisionada):
        // libera o loading para o app decidir (tela de "não autorizado").
        console.warn("Permissão de leitura negada para usuários:", error);
        setLoading(false);
      });

      // 2. Sedes Realtime Sync
      const unsubSedes = onSnapshot(collection(db, 'sedes'), (snapshot: any) => {
        const list: Sede[] = [];
        snapshot.forEach((docSnap: any) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Sede);
        });
        setSedes(list);
      });

      // 3. Regioes Realtime Sync
      const unsubRegioes = onSnapshot(collection(db, 'regioes'), (snapshot: any) => {
        const list: Regiao[] = [];
        snapshot.forEach((docSnap: any) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Regiao);
        });
        setRegioes(list);
      });

      // 4. Cargos Realtime Sync
      const unsubCargos = onSnapshot(collection(db, 'cargos'), (snapshot: any) => {
        const list: Cargo[] = [];
        snapshot.forEach((docSnap: any) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Cargo);
        });
        setCargos(list);
      });

      // 5. Setores Realtime Sync
      const unsubSetores = onSnapshot(collection(db, 'setores'), (snapshot: any) => {
        const list: Setor[] = [];
        snapshot.forEach((docSnap: any) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Setor);
        });
        setSetores(list);
        setLoading(false);
      }, (error: any) => {
        console.warn("Permissão de leitura negada para setores:", error);
        setLoading(false);
      });

      return () => {
        unsubUsuarios();
        unsubSedes();
        unsubRegioes();
        unsubCargos();
        unsubSetores();
      };
    } else if (!isFirebaseEnabled) {
      // Local fallbacks (modo demonstração)
      loadLocalFallback();
    } else {
      // Firebase ativo, mas sem usuário autenticado: não assina (evita
      // permission-denied) e libera o loading para o app exibir a tela de login.
      setLoading(false);
    }
  }, [currentUser]);

  const loadLocalFallback = () => {
    setUsingFirebase(false);

    // Users
    const storedUsers = localStorage.getItem(USERS_LOCAL_KEY);
    if (storedUsers) {
      const parsed = JSON.parse(storedUsers);
      setUsuarios(Array.isArray(parsed) ? parsed : []);
    } else {
      setUsuarios(defaultUsuarios);
      localStorage.setItem(USERS_LOCAL_KEY, JSON.stringify(defaultUsuarios));
    }

    // Sedes
    const storedSedes = localStorage.getItem(SEDES_LOCAL_KEY);
    if (storedSedes) {
      const parsed = JSON.parse(storedSedes);
      setSedes(Array.isArray(parsed) ? parsed : []);
    } else {
      setSedes(defaultSedes);
      localStorage.setItem(SEDES_LOCAL_KEY, JSON.stringify(defaultSedes));
    }

    // Regioes
    const storedRegioes = localStorage.getItem(REGIOES_LOCAL_KEY);
    if (storedRegioes) {
      const parsed = JSON.parse(storedRegioes);
      setRegioes(Array.isArray(parsed) ? parsed : []);
    } else {
      setRegioes(defaultRegioes);
      localStorage.setItem(REGIOES_LOCAL_KEY, JSON.stringify(defaultRegioes));
    }

    // Cargos
    const storedCargos = localStorage.getItem(CARGOS_LOCAL_KEY);
    if (storedCargos) {
      const parsed = JSON.parse(storedCargos);
      setCargos(Array.isArray(parsed) ? parsed : []);
    } else {
      setCargos(defaultCargos);
      localStorage.setItem(CARGOS_LOCAL_KEY, JSON.stringify(defaultCargos));
    }

    // Setores
    const storedSetores = localStorage.getItem(SETORES_LOCAL_KEY);
    if (storedSetores) {
      const parsed = JSON.parse(storedSetores);
      const list = Array.isArray(parsed) ? parsed : [];
      setSetores(list);
    } else {
      setSetores(defaultSetores);
      localStorage.setItem(SETORES_LOCAL_KEY, JSON.stringify(defaultSetores));
    }

    setLoading(false);
  };

  // Compute Active Auth Role based on current user email
  useEffect(() => {
    if (!currentUser) {
      setIsAuthorized(false);
      return;
    }

    const email = currentUser.email?.toLowerCase();
    
    // Bootstrapped Admin
    if (email === 'guizen2006@gmail.com') {
      setSelectedRole('Administrador');
      localStorage.setItem('ats_simulated_role', 'Administrador');
      setIsAuthorized(true);
      const matched = usuarios.find(u => u.email && u.email.toLowerCase() === email);
      if (matched && matched.sede) {
        setSelectedSede(matched.sede);
        localStorage.setItem('ats_simulated_sede', matched.sede);
      }
      return;
    }

    const matched = usuarios.find(u => u.email && u.email.toLowerCase() === email);
    if (matched) {
      setSelectedRole(matched.role);
      localStorage.setItem('ats_simulated_role', matched.role);
      setIsAuthorized(true);
      if (matched.sede) {
        setSelectedSede(matched.sede);
        localStorage.setItem('ats_simulated_sede', matched.sede);
      }
    } else {
      // Default fallback if authenticated but not registered
      setSelectedRole('Analista');
      localStorage.setItem('ats_simulated_role', 'Analista');
      
      if (loading) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
    }
  }, [currentUser, usuarios, loading]);

  // Operations: Users
  const addUsuario = async (email: string, role: UserRole, sede?: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    if (usingFirebase && db) {
      try {
        await setDoc(doc(db, 'usuarios', cleanEmail), {
          email: cleanEmail,
          role,
          sede: sede || ''
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `usuarios/${cleanEmail}`);
      }
    } else {
      const newUser: Usuario = {
        id: `local_user_${Date.now()}`,
        email: cleanEmail,
        role,
        sede: sede || ''
      };
      const updated = [...usuarios.filter(u => (u.email || '').toLowerCase() !== cleanEmail.toLowerCase()), newUser];
      setUsuarios(updated);
      localStorage.setItem(USERS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const deleteUsuario = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, 'usuarios', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `usuarios/${id}`);
      }
    } else {
      const updated = usuarios.filter(u => u.id !== id && u.email !== id);
      setUsuarios(updated);
      localStorage.setItem(USERS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const updateUsuario = async (id: string, email: string, role: UserRole, sede?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    if (usingFirebase && db) {
      try {
        if (id !== cleanEmail) {
          await deleteDoc(doc(db, 'usuarios', id));
          await setDoc(doc(db, 'usuarios', cleanEmail), {
            email: cleanEmail,
            role,
            sede: sede || ''
          });
        } else {
          await setDoc(doc(db, 'usuarios', id), {
            email: cleanEmail,
            role,
            sede: sede || ''
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `usuarios/${id}`);
      }
    } else {
      const updated = usuarios.map(u => {
        if (u.id === id || u.email === id) {
          return { ...u, email: cleanEmail, role, sede: sede || '' };
        }
        return u;
      });
      setUsuarios(updated);
      localStorage.setItem(USERS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  // Operations: Sede
  const addSede = async (nome: string, regiao: string, sigla?: string) => {
    const cleanNome = nome.trim();
    if (!cleanNome) return;

    if (usingFirebase && db) {
      try {
        await addDoc(collection(db, 'sedes'), {
          nome: cleanNome,
          regiao,
          sigla: sigla ? sigla.trim().toUpperCase() : ''
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'sedes');
      }
    } else {
      const newSede: Sede = {
        id: `local_sede_${Date.now()}`,
        nome: cleanNome,
        regiao,
        sigla: sigla ? sigla.trim().toUpperCase() : ''
      };
      const updated = [...sedes, newSede];
      setSedes(updated);
      localStorage.setItem(SEDES_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const deleteSede = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, 'sedes', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `sedes/${id}`);
      }
    } else {
      const updated = sedes.filter(s => s.id !== id);
      setSedes(updated);
      localStorage.setItem(SEDES_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const updateSede = async (id: string, nome: string, regiao: string, sigla?: string) => {
    const cleanNome = nome.trim();
    if (!cleanNome) return;

    if (usingFirebase && db) {
      try {
        await updateDoc(doc(db, 'sedes', id), {
          nome: cleanNome,
          regiao,
          sigla: sigla ? sigla.trim().toUpperCase() : ''
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `sedes/${id}`);
      }
    } else {
      const updated = sedes.map(s => s.id === id ? { ...s, nome: cleanNome, regiao, sigla: sigla ? sigla.trim().toUpperCase() : '' } : s);
      setSedes(updated);
      localStorage.setItem(SEDES_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  // Operations: Regiao
  const addRegiao = async (nome: string) => {
    const cleanNome = nome.trim();
    if (!cleanNome) return;

    if (usingFirebase && db) {
      try {
        await addDoc(collection(db, 'regioes'), {
          nome: cleanNome
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'regioes');
      }
    } else {
      const newRegiao: Regiao = {
        id: `local_regiao_${Date.now()}`,
        nome: cleanNome
      };
      const updated = [...regioes, newRegiao];
      setRegioes(updated);
      localStorage.setItem(REGIOES_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const deleteRegiao = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, 'regioes', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `regioes/${id}`);
      }
    } else {
      const updated = regioes.filter(r => r.id !== id);
      setRegioes(updated);
      localStorage.setItem(REGIOES_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const updateRegiao = async (id: string, nome: string) => {
    const cleanNome = nome.trim();
    if (!cleanNome) return;

    if (usingFirebase && db) {
      try {
        await updateDoc(doc(db, 'regioes', id), {
          nome: cleanNome
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `regioes/${id}`);
      }
    } else {
      const updated = regioes.map(r => r.id === id ? { ...r, nome: cleanNome } : r);
      setRegioes(updated);
      localStorage.setItem(REGIOES_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  // Operations: Cargo
  const addCargo = async (nome: string) => {
    const cleanNome = nome.trim();
    if (!cleanNome) return;

    if (usingFirebase && db) {
      try {
        await addDoc(collection(db, 'cargos'), {
          nome: cleanNome
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'cargos');
      }
    } else {
      const newCargo: Cargo = {
        id: `local_cargo_${Date.now()}`,
        nome: cleanNome
      };
      const updated = [...cargos, newCargo];
      setCargos(updated);
      localStorage.setItem(CARGOS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const deleteCargo = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, 'cargos', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `cargos/${id}`);
      }
    } else {
      const updated = cargos.filter(c => c.id !== id);
      setCargos(updated);
      localStorage.setItem(CARGOS_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  // Operations: Setor
  const addSetor = async (nome: string) => {
    const cleanNome = nome.trim();
    if (!cleanNome) return;

    if (usingFirebase && db) {
      try {
        await addDoc(collection(db, 'setores'), {
          nome: cleanNome
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'setores');
      }
    } else {
      const newSetor: Setor = {
        id: `local_setor_${Date.now()}`,
        nome: cleanNome
      };
      const updated = [...setores, newSetor];
      setSetores(updated);
      localStorage.setItem(SETORES_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  const deleteSetor = async (id: string) => {
    if (usingFirebase && db) {
      try {
        await deleteDoc(doc(db, 'setores', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `setores/${id}`);
      }
    } else {
      const updated = setores.filter(s => s.id !== id);
      setSetores(updated);
      localStorage.setItem(SETORES_LOCAL_KEY, JSON.stringify(updated));
    }
  };

  return {
    usuarios,
    sedes,
    regioes,
    cargos,
    setores,
    loading,
    isAuthorized,
    usingFirebase,
    userRole,
    isAdmin,
    isViewer,
    selectedRole,
    setSelectedRole: changeSelectedRole,
    selectedSede,
    setSelectedSede: changeSelectedSede,
    addUsuario,
    updateUsuario,
    deleteUsuario,
    addSede,
    updateSede,
    deleteSede,
    addRegiao,
    updateRegiao,
    deleteRegiao,
    addCargo,
    deleteCargo,
    addSetor,
    deleteSetor
  };
}
