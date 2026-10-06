import { acceptSource, bindSource, listenSource, socketSource } from './kernelSetupSyscalls';
import { closeSource, connectSource, recvSource, sendSource } from './kernelIoSyscalls';
import { epollCreateSource, epollCtlSource, epollWaitSource } from './kernelEpollSyscalls';
import type { KernelSource, SyscallId } from '../types/kernel';

export const kernelSources: Record<SyscallId, KernelSource> = {
  socket: socketSource,
  bind: bindSource,
  listen: listenSource,
  accept: acceptSource,
  connect: connectSource,
  send: sendSource,
  recv: recvSource,
  close: closeSource,
  epoll_create: epollCreateSource,
  epoll_ctl: epollCtlSource,
  epoll_wait: epollWaitSource
};