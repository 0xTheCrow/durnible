export const createRoomEncryptionState = () => ({
  type: 'm.room.encryption',
  state_key: '',
  content: {
    algorithm: 'm.megolm.v1.aes-sha2',
  },
});
