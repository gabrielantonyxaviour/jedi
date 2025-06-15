// lib/story.ts
import { x`` StoryConfig, IpMetadata } from '@story-protocol/core-sdk'
import { Address, createHash } from 'viem'
import { Account } from 'viem'

export async function registerIp(account: Account) {
  const config: StoryConfig = {
    account,
    rpcUrl: process.env.RPC_URL || 'https://odyssey.storyrpc.io',
    chainId: 'odyssey',
  }z

  const client = StoryAPI.create(config)
  const spgNftContract = process.env.SPG_NFT_CONTRACT as Address

  // Simple project metadata
  const ipMetadata: IpMetadata = client.ipAsset.generateIpMetadata({
    title: 'My Project',
    description: 'Test IP registration',
    createdAt: Math.floor(Date.now() / 1000).toString(),
    creators: [{
      name: 'Developer',
      address: account.address,
      contributionPercent: 100,
    }],
    mediaType: 'text/plain',
  })

  const nftMetadata = {
    name: 'Project IP',
    description: 'IP Certificate',
    image: '',
    attributes: [{ trait_type: 'Type', value: 'Original' }],
  }

  // Mock IPFS hashes
  const ipHash = createHash('sha256').update(JSON.stringify(ipMetadata)).digest('hex')
  const nftHash = createHash('sha256').update(JSON.stringify(nftMetadata)).digest('hex')

  const response = await client.ipAsset.mintAndRegisterIpAssetWithPilTerms({
    spgNftContract,
    licenseTermsData: [{
      terms: ,
    }],
    ipMetadata: {
      ipMetadataURI: `ipfs://Qm${ipHash.substring(0, 44)}`,
      ipMetadataHash: `0x${ipHash}`,
      nftMetadataURI: `ipfs://Qm${nftHash.substring(0, 44)}`,
      nftMetadataHash: `0x${nftHash}`,
    },
  })

  return response
}