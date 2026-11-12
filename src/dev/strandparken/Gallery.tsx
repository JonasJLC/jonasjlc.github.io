import { Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Avatar, AvatarButton } from '../../components/strandparken/ui/avatar';
import { Badge } from '../../components/strandparken/ui/badge';
import { Button } from '../../components/strandparken/ui/button';
import { Card, CardRow } from '../../components/strandparken/ui/card';
import { Checkbox } from '../../components/strandparken/ui/checkbox';
import { Chip } from '../../components/strandparken/ui/chip';
import { DishImage, DishSlot } from '../../components/strandparken/ui/dish-image';
import { Field } from '../../components/strandparken/ui/field';
import { Icon } from '../../components/strandparken/ui/icon';
import { SegmentedControl, SegmentedPanel } from '../../components/strandparken/ui/segmented-control';
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from '../../components/strandparken/ui/sheet';
import { Stepper } from '../../components/strandparken/ui/stepper';
import { notify, Toaster } from '../../components/strandparken/ui/toast';

const samplePhoto = '/ferie/avatars/camilla.jpg';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-sp-gap">
      <h2 id={`${id}-h`} className="sp-title-section">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-sp-gap-row">
      <span className="sp-caption text-sp-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-sp-gap-grid">{children}</div>
    </div>
  );
}

export default function Gallery() {
  const [chips, setChips] = useState<string[]>(['Aftensmad']);
  const [persons, setPersons] = useState(2);
  const [view, setView] = useState('alle');
  const [item, setItem] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-sp-column flex-col gap-sp-gap-home px-sp-page-x pt-sp-page-top pb-sp-page-bottom">
      <header className="flex flex-col gap-sp-gap-row">
        <h1 className="sp-title-page">Strandparken galleri</h1>
        <p className="sp-small text-sp-muted">
          Kun til udvikling. Tab for at se fokus, hold nede for at se tryk. Alle komponenter står på den rigtige baggrundsfarve.
        </p>
      </header>

      <Section id="knapper" title="Knapper">
        <Row label="Primær (52) og i kort (46)">
          <Button>Lav indkøbsliste</Button>
          <Button inCard>Se opskrift</Button>
        </Row>
        <Row label="Outline og stille">
          <Button variant="outline">Tag opgaven</Button>
          <Button variant="quiet">Rediger</Button>
          <Button variant="outline" asChild><a href="#knapper">Som link</a></Button>
        </Row>
        <Row label="Ikon: bund, tilføj, stor">
          <Button variant="icon" aria-label="Luk"><Icon icon={X} /></Button>
          <Button variant="icon" tone="add" aria-label="Tilføj"><Icon icon={Plus} /></Button>
          <Button variant="icon" tone="add" size="lg" aria-label="Tilføj opskrift"><Icon icon={Plus} /></Button>
        </Row>
        <Row label="Deaktiveret">
          <Button disabled>Primær</Button>
          <Button variant="outline" disabled>Outline</Button>
          <Button variant="quiet" disabled>Stille</Button>
          <Button variant="icon" tone="add" aria-label="Tilføj" disabled><Icon icon={Plus} /></Button>
        </Row>
      </Section>

      <Section id="kort" title="Kort og rækker">
        <Card>
          <CardRow className="py-3 sp-body-strong">Første række</CardRow>
          <CardRow className="py-3 sp-body-strong">Anden række</CardRow>
          <CardRow className="py-3 sp-body-strong">Tredje række</CardRow>
        </Card>
      </Section>

      <Section id="badges" title="Badges">
        <Row label="Neutral, positiv, forfalden">
          <Badge>Idé</Badge>
          <Badge tone="positive">I dag</Badge>
          <Badge tone="danger">2 forfaldne</Badge>
        </Row>
        <Row label="Person og fælles">
          <Badge tone="person" person="jonas">Jonas</Badge>
          <Badge tone="person" person="camilla">Camilla</Badge>
          <Badge tone="person" person="shared">Fælles</Badge>
        </Row>
      </Section>

      <Section id="avatarer" title="Avatarer">
        <Row label="Foto: 44, 34, 30">
          <Avatar person="jonas" size={44} />
          <Avatar person="camilla" size={34} />
          <Avatar person="jonas" size={30} />
        </Row>
        <Row label="Uden foto: initial på personens farve">
          <Avatar person="jonas" size={44} photo={null} />
          <Avatar person="camilla" size={34} photo={null} />
          <Avatar person="jonas" size={30} photo={null} />
        </Row>
        <Row label="Som knap (44, med aria-label)">
          <AvatarButton person="jonas" label="Indstillinger" />
        </Row>
      </Section>

      <Section id="chips" title="Chips">
        <Row label="Valgt og ikke valgt (klik)">
          {['Aftensmad', 'Sødt', 'Bagværk', 'Frokost'].map((c) => (
            <Chip key={c} selected={chips.includes(c)} onClick={() => setChips((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}>
              {c}
            </Chip>
          ))}
        </Row>
      </Section>

      <Section id="segmenter" title="Segmenteret kontrol">
        <SegmentedControl aria-label="Visning" options={[{ value: 'alle', label: 'Alle' }, { value: 'ideer', label: 'Aftensmadsidéer' }]} value={view} onValueChange={setView}>
          <SegmentedPanel value="alle" className="sp-small pt-2 text-sp-muted">Viser alle opskrifter.</SegmentedPanel>
          <SegmentedPanel value="ideer" className="sp-small pt-2 text-sp-muted">Viser aftensmadsidéer.</SegmentedPanel>
        </SegmentedControl>
        <SegmentedControl aria-label="Opskrift" defaultValue="ing" options={[{ value: 'ing', label: 'Ingredienser' }, { value: 'fra', label: 'Fremgangsmåde' }, { value: 'nae', label: 'Næring' }]}>
          <SegmentedPanel value="ing" className="sp-small pt-2 text-sp-muted">Ingredienser.</SegmentedPanel>
          <SegmentedPanel value="fra" className="sp-small pt-2 text-sp-muted">Fremgangsmåde.</SegmentedPanel>
          <SegmentedPanel value="nae" className="sp-small pt-2 text-sp-muted">Næring.</SegmentedPanel>
        </SegmentedControl>
      </Section>

      <Section id="afkrydsning" title="Afkrydsning">
        <Row label="Rund (opgaver, varer): fra, til, deaktiveret">
          <Checkbox aria-label="Opgave" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
          <Checkbox aria-label="Opgave udført" defaultChecked />
          <Checkbox aria-label="Opgave deaktiveret" disabled />
        </Row>
        <Row label="Firkantet (vaner): fra, til, deaktiveret">
          <Checkbox shape="square" aria-label="Vane" />
          <Checkbox shape="square" aria-label="Vane udført" defaultChecked />
          <Checkbox shape="square" aria-label="Vane deaktiveret" disabled />
        </Row>
      </Section>

      <Section id="stepper" title="Antal personer">
        <Row label="Interaktiv (1 til 8)"><div className="w-full"><Stepper value={persons} onChange={setPersons} /></div></Row>
        <Row label="Nedre grænse (1)"><div className="w-full"><Stepper value={1} onChange={() => {}} /></div></Row>
        <Row label="Øvre grænse (8)"><div className="w-full"><Stepper value={8} onChange={() => {}} /></div></Row>
      </Section>

      <Section id="felter" title="Felter">
        <Field label="Søg i opskrifter" placeholder="Søg i opskrifter" />
        <Field
          label="Tilføj vare"
          placeholder="Tilføj vare"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          action={{ label: 'Tilføj varen', icon: Plus, onClick: () => { if (item.trim()) { setAdded((a) => [...a, item.trim()]); setItem(''); } } }}
        />
        {added.length > 0 && <p className="sp-small text-sp-muted">Tilføjet: {added.join(', ')}</p>}
      </Section>

      <Section id="ark" title="Ark">
        <Row label="Åbn fra en knap">
          <Sheet>
            <SheetTrigger asChild><Button variant="outline">Kort ark</Button></SheetTrigger>
            <SheetContent>
              <SheetHeader title="Indstillinger" />
              <p className="sp-body text-sp-muted">Ingen indstillinger endnu.</p>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild><Button variant="outline">Højt ark</Button></SheetTrigger>
            <SheetContent>
              <SheetHeader title="Hvad skal I have?" eyebrow="Onsdag 11. november" />
              <Card className="p-0">
                {Array.from({ length: 24 }, (_, i) => (
                  <CardRow key={i} className="sp-body-strong px-sp-pad-card py-3">Ret {i + 1}</CardRow>
                ))}
              </Card>
            </SheetContent>
          </Sheet>
        </Row>
      </Section>

      <Section id="beskeder" title="Beskeder">
        <Row label="Kort besked og med Fortryd">
          <Button variant="outline" onClick={() => notify('Opskrift gemt')}>Kort besked</Button>
          <Button variant="outline" onClick={() => notify('Afkrydsede varer ryddet', { onUndo: () => notify('Fortrudt') })}>Med fortryd</Button>
        </Row>
      </Section>

      <Section id="billeder" title="Retbilleder">
        <Row label="Rund: 52, 56, 64 (foto)">
          <DishImage shape="round" size={52} name="Lasagne" src={samplePhoto} />
          <DishImage shape="round" size={56} name="Tærte" src={samplePhoto} />
          <DishImage shape="round" size={64} name="Boller" src={samplePhoto} />
        </Row>
        <Row label="Rund uden foto og med fejlende foto: bogstav">
          <DishImage shape="round" size={52} name="Æggekage" />
          <DishImage shape="round" size={56} name="Risotto" src="/findes-ikke.jpg" />
          <DishImage shape="round" size={64} name="Boller" />
        </Row>
        <Row label="Tom plads">
          <DishSlot size={52} />
          <DishSlot size={56} />
          <DishSlot size={64} />
        </Row>
        <Row label="Fyldt (cover): foto og bogstav">
          <div className="h-33 w-48"><DishImage shape="cover" name="Pasta" src={samplePhoto} /></div>
          <div className="h-33 w-48"><DishImage shape="cover" name="Pasta" /></div>
        </Row>
      </Section>

      <Toaster />
    </main>
  );
}
