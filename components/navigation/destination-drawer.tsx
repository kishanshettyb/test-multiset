'use client'

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

import { Button } from '@/components/ui/button'

import {
  MapPin,
  Navigation,
  X,
} from 'lucide-react'

export type DestinationItem = {
  id: string
  name: string
}

type DestinationDrawerProps = {
  destinations: DestinationItem[]
  selectedId: string | null
  disabled?: boolean
  onSelect: (id: string) => void
}

export function DestinationDrawer({
  destinations,
  selectedId,
  disabled = false,
  onSelect,
}: DestinationDrawerProps) {
  const selected = destinations.find(
    item => item.id === selectedId
  )

  return (
    <Drawer>
      <DrawerTrigger>
        <Button
          disabled={disabled}
          className="h-12 rounded-2xl bg-white px-5 text-black shadow-xl hover:bg-white/90"
        >
          <MapPin className="mr-2 h-5 w-5" />

          {selected
            ? selected.name
            : 'Select destination'}
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>
              Where do you want to go?
            </DrawerTitle>

            <DrawerDescription>
              Select a destination to start indoor navigation.
            </DrawerDescription>
          </DrawerHeader>

          <div className="max-h-[55vh] overflow-y-auto px-4 pb-4">
            <div className="grid gap-2">
              {destinations.map(destination => {
                const active =
                  destination.id === selectedId

                return (
                  <Button
                    key={destination.id}
                    type="button"
                    variant={
                      active
                        ? 'default'
                        : 'outline'
                    }
                    className={[
                      'h-14 w-full justify-start rounded-xl',
                      active
                        ? 'bg-violet-600 hover:bg-violet-600'
                        : '',
                    ].join(' ')}
                    onClick={() =>
                      onSelect(destination.id)
                    }
                  >
                    <Navigation className="mr-3 h-5 w-5" />

                    <span className="text-base">
                      {destination.name}
                    </span>

                    {active && (
                      <span className="ml-auto text-xs opacity-80">
                        Selected
                      </span>
                    )}
                  </Button>
                )
              })}
            </div>
          </div>

          <DrawerFooter>
            <DrawerClose>
              <Button
                variant="outline"
                className="h-12 rounded-xl"
              >
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}