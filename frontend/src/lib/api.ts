import axios from 'axios'

const BASE_URL = '/api/plume-api';

export async function fetchTokens(address: string) {
  try {
    const url = `${BASE_URL}/wallet-balance?walletAddress=${address}`
    const response = await axios.get(url)
    return response.data
  } catch (error) {
    console.error('Failed to fetch NFTs:', error)
    throw error
  }
}
