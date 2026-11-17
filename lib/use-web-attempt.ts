"use client";

import {useSession} from 'next-auth/react';
import {useRef} from 'react';
import {recoverWebAttempt} from './actions/web-attempt-recovery';
import {durableWebAttempt,attemptSlot,type WebAttemptKind} from './web-attempt-client';

export function useWebAttempt<T>(action: (input: unknown, key: string) => Promise<T>,kind:WebAttemptKind) {
  const {data:session}=useSession();
  const identity=useRef('');identity.current=session?.user?.id?`${session.user.empresaId}:${session.user.id}`:'';
  return async (input: unknown): Promise<T> => {
    if(!session?.user?.id||!session.user.empresaId)throw new Error('Espera la validación de tu sesión antes de enviar.');
    const owner=identity.current;
    const result=await durableWebAttempt(attemptSlot(session.user.empresaId,session.user.id,kind),kind,input,action,recoverWebAttempt);
    if(owner!==identity.current)throw new Error('La sesión cambió. Revisa el resultado en la cuenta que originó la operación.');
    return result;
  };
}
