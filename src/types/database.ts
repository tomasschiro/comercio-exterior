export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Rol = 'superadmin' | 'operador'

export interface Perfil {
  id: string
  email: string
  nombre: string | null
  rol: Rol
  aprobado: boolean
  created_at: string
}

export interface Operacion {
  id: number
  interno: number | null
  recep_doc: string | null
  cliente: string | null
  crt: string | null
  senasa: string | null
  despacho: string | null
  oficializacion: string | null
  aviso: string | null
  nota_entrega: string | null
  liberacion: string | null
  created_by: string | null
  created_by_email: string | null
  created_at: string
}

export type EstadoOperacion =
  | 'Pendiente'
  | 'En proceso'
  | 'Oficializado'
  | 'Avisado'
  | 'Nota de entrega'
  | 'Liberado'

export function getEstadoOperacion(op: Operacion): EstadoOperacion {
  if (op.liberacion) return 'Liberado'
  if (op.nota_entrega) return 'Nota de entrega'
  if (op.aviso) return 'Avisado'
  if (op.oficializacion) return 'Oficializado'
  if (op.recep_doc) return 'En proceso'
  return 'Pendiente'
}

export type NuevaOperacion = Omit<Operacion, 'id' | 'created_at' | 'created_by' | 'created_by_email'>
