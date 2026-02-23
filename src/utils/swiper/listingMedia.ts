// File: src/utils/swiper/listingMedia.ts

import type { SwiperOptions } from 'swiper/types'
import type { SwiperModule } from 'swiper/types'
import { Autoplay, Navigation, Pagination } from 'swiper/modules'

type ListingMediaSwiperInput = {
  autoplay?: boolean
  withAutoplayModule?: boolean
  withNavigationModule?: boolean
  withPaginationModule?: boolean
  navigation?: SwiperOptions['navigation']
  pagination?: SwiperOptions['pagination']
  slidesPerView?: number
  spaceBetween?: number
  centeredSlides?: boolean
}

export function createListingMediaSwiperParams({
  autoplay = false,
  withAutoplayModule,
  withNavigationModule,
  withPaginationModule,
  navigation = false,
  pagination = false,
  slidesPerView = 1,
  spaceBetween = 0,
  centeredSlides = true,
}: ListingMediaSwiperInput = {}) {
  const modules: SwiperModule[] = []

  const useAutoplayModule = withAutoplayModule ?? autoplay
  const usePaginationModule = withPaginationModule ?? Boolean(pagination)
  const useNavigationModule = withNavigationModule ?? Boolean(navigation)

  if (useAutoplayModule) modules.push(Autoplay as SwiperModule)
  if (usePaginationModule) modules.push(Pagination as SwiperModule)
  if (useNavigationModule) modules.push(Navigation as SwiperModule)

  return {
    modules,
    direction: 'horizontal',
    slidesPerView,
    spaceBetween,
    centeredSlides,

    watchOverflow: true,
    resistanceRatio: 0.85,
    threshold: 6,

    preventClicks: true,
    preventClicksPropagation: true,

    autoplay: autoplay
      ? {
          delay: 3000,
          disableOnInteraction: true,
        }
      : false,

    pagination,
    navigation,
  } satisfies SwiperOptions
}
