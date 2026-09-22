import FloatingParticles from './FloatingParticles';

export default function AiStudioHubParticles() {
  return (
    <FloatingParticles
      containerClassName="ai-studio-scene__particles"
      particleClassName="ai-studio-scene__particle"
      count={100}
    />
  );
}
