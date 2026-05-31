import { Composition } from 'remotion'
import { ContinuousFunctionTour } from './ContinuousFunctionTour'

export const RemotionRoot = () => {
  return (
    <Composition
      id="ContinuousFunctionTour"
      component={ContinuousFunctionTour}
      durationInFrames={1260}
      fps={30}
      width={1920}
      height={1080}
    />
  )
}
