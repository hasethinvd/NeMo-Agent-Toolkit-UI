/**
 * Global MFA Operation State Management
 * Prevents race conditions between multiple MFA operations
 */

interface MFAOperationState {
  isSetupInProgress: boolean;
  isVerificationInProgress: boolean;
  isSessionValidationInProgress: boolean;
  currentOperationId: string | null;
  userId: string | null;
}

interface UserMFAState {
  [userId: string]: MFAOperationState;
}

class MFAStateManager {
  private userStates: UserMFAState = {};
  private globalLock = new Map<string, Promise<void>>();
  private listeners: Array<(userId: string, state: MFAOperationState) => void> = [];

  /**
   * Get or create state for a user
   */
  private getUserState(userId: string): MFAOperationState {
    if (!this.userStates[userId]) {
      this.userStates[userId] = {
        isSetupInProgress: false,
        isVerificationInProgress: false,
        isSessionValidationInProgress: false,
        currentOperationId: null,
        userId: userId
      };
    }
    return this.userStates[userId];
  }

  /**
   * Start an MFA setup operation for a specific user
   */
  startSetup(userId: string, operationId: string): boolean {
    const userState = this.getUserState(userId);
    
    if (userState.isSetupInProgress || userState.isVerificationInProgress) {
      console.log('🔒 MFA operation already in progress for user:', userId);
      return false;
    }

    userState.isSetupInProgress = true;
    userState.currentOperationId = operationId;
    this.notifyListeners(userId);
    console.log('🔐 MFA setup started for user:', userId, 'operation:', operationId);
    return true;
  }

  /**
   * End an MFA setup operation for a specific user
   */
  endSetup(userId: string, operationId: string): void {
    const userState = this.getUserState(userId);
    if (userState.currentOperationId === operationId) {
      userState.isSetupInProgress = false;
      userState.currentOperationId = null;
      this.notifyListeners(userId);
      console.log('🔐 MFA setup ended for user:', userId, 'operation:', operationId);
    }
  }

  /**
   * Start an MFA verification operation for a specific user
   */
  startVerification(userId: string, operationId: string): boolean {
    const userState = this.getUserState(userId);
    
    if (userState.isVerificationInProgress || userState.isSetupInProgress) {
      console.log('🔒 MFA operation already in progress for user:', userId);
      return false;
    }

    userState.isVerificationInProgress = true;
    userState.currentOperationId = operationId;
    this.notifyListeners(userId);
    console.log('🔐 MFA verification started for user:', userId, 'operation:', operationId);
    return true;
  }

  /**
   * End an MFA verification operation for a specific user
   */
  endVerification(userId: string, operationId: string): void {
    const userState = this.getUserState(userId);
    if (userState.currentOperationId === operationId) {
      userState.isVerificationInProgress = false;
      userState.currentOperationId = null;
      this.notifyListeners(userId);
      console.log('🔐 MFA verification ended for user:', userId, 'operation:', operationId);
    }
  }

  /**
   * Start a session validation operation for a specific user
   */
  startSessionValidation(userId: string, operationId: string): boolean {
    const userState = this.getUserState(userId);
    
    if (userState.isSessionValidationInProgress) {
      console.log('🔒 Session validation already in progress for user:', userId);
      return false;
    }

    userState.isSessionValidationInProgress = true;
    this.notifyListeners(userId);
    return true;
  }

  /**
   * End a session validation operation for a specific user
   */
  endSessionValidation(userId: string, operationId: string): void {
    const userState = this.getUserState(userId);
    userState.isSessionValidationInProgress = false;
    this.notifyListeners(userId);
  }

  /**
   * Get current state for a user (public method)
   */
  getState(userId: string): Readonly<MFAOperationState> {
    return { ...this.getUserState(userId) };
  }

  /**
   * Check if any MFA operation is in progress for a specific user
   */
  isUserOperationInProgress(userId: string): boolean {
    const userState = this.getUserState(userId);
    return (
      userState.isSetupInProgress ||
      userState.isVerificationInProgress ||
      userState.isSessionValidationInProgress
    );
  }

  /**
   * Check if any MFA operation is in progress globally (across all users)
   */
  isAnyOperationInProgress(): boolean {
    return Object.values(this.userStates).some(state =>
      state.isSetupInProgress ||
      state.isVerificationInProgress ||
      state.isSessionValidationInProgress
    );
  }

  /**
   * Force clear all operations (use with caution)
   */
  forceReset(): void {
    // Clear all user states
    const userIds = Object.keys(this.userStates);
    this.userStates = {};
    
    // Notify listeners for all affected users
    userIds.forEach(userId => {
      this.notifyListeners(userId);
    });
    
    console.log('🔐 MFA state forcefully reset for all users');
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (userId: string, state: MFAOperationState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(userId: string): void {
    const userState = this.getUserState(userId);
    this.listeners.forEach(listener => {
      try {
        listener(userId, userState);
      } catch (error) {
        console.error('Error in MFA state listener:', error);
      }
    });
  }
}

// Global instance
const mfaStateManager = new MFAStateManager();

// Utility functions for easier use
export function generateOperationId(): string {
  return `mfa_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function startMFASetup(userId: string): string | null {
  const operationId = generateOperationId();
  if (mfaStateManager.startSetup(userId, operationId)) {
    return operationId;
  }
  return null;
}

export function endMFASetup(userId: string, operationId: string): void {
  mfaStateManager.endSetup(userId, operationId);
}

export function startMFAVerification(userId: string): string | null {
  const operationId = generateOperationId();
  if (mfaStateManager.startVerification(userId, operationId)) {
    return operationId;
  }
  return null;
}

export function endMFAVerification(userId: string, operationId: string): void {
  mfaStateManager.endVerification(userId, operationId);
}

export function startMFASessionValidation(userId: string): string | null {
  const operationId = generateOperationId();
  if (mfaStateManager.startSessionValidation(userId, operationId)) {
    return operationId;
  }
  return null;
}

export function endMFASessionValidation(userId: string, operationId: string): void {
  mfaStateManager.endSessionValidation(userId, operationId);
}

export function isMFAOperationInProgress(userId?: string): boolean {
  if (userId) {
    return mfaStateManager.isUserOperationInProgress(userId);
  }
  return mfaStateManager.isAnyOperationInProgress();
}

export function getMFAState(userId: string): Readonly<MFAOperationState> {
  return mfaStateManager.getState(userId);
}

export function subscribeMFAState(listener: (userId: string, state: MFAOperationState) => void): () => void {
  return mfaStateManager.subscribe(listener);
}

export function resetMFAState(): void {
  mfaStateManager.forceReset();
}

export default mfaStateManager;
